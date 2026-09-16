//! Safe local bridge from OpenCloser to workspace-scoped Antigravity agents.
//!
//! Only allowlisted agents can be started. The bridge never accepts arbitrary
//! shell commands and does not enable --dangerously-skip-permissions.
//!
//! Hardening:
//! - concurrency cap (`MAX_RUNNING_JOBS`), per-job wall-clock timeout with kill;
//! - `cancel_agy_agent` command kills a running child;
//! - every lifecycle event is appended to an audit log (`.agy-audit.jsonl`
//!   inside the workspace) and to the app log;
//! - the agent's owned paths are passed in the prompt AND audited. True
//!   filesystem sandboxing of the child process requires OS-level isolation
//!   (Job Object / AppContainer) and is tracked separately — do not rely on
//!   the prompt alone as a security boundary.

use serde::Serialize;
use std::collections::HashMap;
use std::env;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::timeout;

const DEFAULT_WORKSPACE: &str = r"G:\tools\telegram-userbot";
const DEFAULT_MODEL: &str = "gemini-3.8-flash-high";
const PRINT_TIMEOUT: &str = "20m";
const MAX_TASK_LEN: usize = 12_000;
const MAX_OUTPUT_LEN: usize = 64_000;
const MAX_RUNNING_JOBS: usize = 2;
const JOB_TIMEOUT_SECS: u64 = 25 * 60;
static NEXT_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgyAgentDescriptor {
    pub id: String,
    pub description: String,
    pub owned_paths: Vec<String>,
    pub read_only: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgyJob {
    pub id: String,
    pub agent: String,
    pub status: String,
    pub task_preview: String,
    pub output: String,
    pub exit_code: Option<i32>,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
}

#[derive(Clone)]
pub struct AgyState {
    jobs: Arc<Mutex<HashMap<String, AgyJob>>>,
    children: Arc<Mutex<HashMap<String, Arc<AsyncMutex<tokio::process::Child>>>>>,
}

impl Default for AgyState {
    fn default() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            children: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

fn catalog() -> Vec<AgyAgentDescriptor> {
    vec![
        AgyAgentDescriptor {
            id: "goal-explorer".into(),
            description: "Read-only repository map and task decomposition.".into(),
            owned_paths: vec!["read-only".into()],
            read_only: true,
        },
        AgyAgentDescriptor {
            id: "goal-backend".into(),
            description: "Python, CLI, config, and backend-test implementation.".into(),
            owned_paths: vec![
                "src/".into(),
                "scripts/".into(),
                "config/".into(),
                "tests/".into(),
            ],
            read_only: false,
        },
        AgyAgentDescriptor {
            id: "goal-frontend".into(),
            description: "OpenCloser dashboard/API/UI implementation.".into(),
            owned_paths: vec!["dashboard/".into()],
            read_only: false,
        },
        AgyAgentDescriptor {
            id: "goal-verifier".into(),
            description: "Independent tests, build, smoke, and safety-gate verification.".into(),
            owned_paths: vec!["read-only".into()],
            read_only: true,
        },
    ]
}

fn is_allowed_agent(agent: &str) -> bool {
    catalog().iter().any(|item| item.id == agent)
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn workspace() -> Result<PathBuf, String> {
    // Release builds always run inside the fixed canonical workspace. The
    // environment override exists only for debug/test sandboxes so that a
    // compromised WebView cannot redirect agents to arbitrary directories.
    #[cfg(not(debug_assertions))]
    let path = PathBuf::from(DEFAULT_WORKSPACE);
    #[cfg(debug_assertions)]
    let path = match env::var("OPEN_CLOSER_AGY_WORKSPACE") {
        Ok(overridden) => {
            log::warn!(
                "AGY workspace overridden via OPEN_CLOSER_AGY_WORKSPACE (debug/sandbox use only)"
            );
            PathBuf::from(overridden)
        }
        Err(_) => PathBuf::from(DEFAULT_WORKSPACE),
    };

    let canonical = path.canonicalize().map_err(|e| {
        format!(
            "AGY workspace is not accessible: {} ({})",
            path.display(),
            e
        )
    })?;
    if !canonical.is_dir() {
        return Err(format!(
            "AGY workspace is not a directory: {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn audit(workspace: &std::path::Path, event: &str, job_id: &str, agent: &str, detail: &str) {
    log::info!(target: "agy_audit", "{} job={} agent={} {}", event, job_id, agent, detail);
    let entry = format!(
        "{{\"ts\":{},\"event\":\"{}\",\"job\":\"{}\",\"agent\":\"{}\",\"detail\":\"{}\"}}\n",
        now(),
        event,
        job_id,
        agent,
        detail.replace('"', "'")
    );
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(workspace.join(".agy-audit.jsonl"))
    {
        let _ = file.write_all(entry.as_bytes());
    }
}

fn model() -> String {
    let requested = env::var("OPEN_CLOSER_AGY_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.into());
    let allowed = [
        "gemini-3.8-flash-high",
        "gemini-3.8-flash-medium",
        "gemini-3.8-flash-low",
        "gemini-3.7-flash-high",
        "gemini-3.7-flash-medium",
        "gemini-3.7-flash-low",
        "gemini-3.6-flash-high",
        "gemini-3.6-flash-medium",
        "gemini-3.6-flash-low",
        "gemini-3.1-pro-high",
        "gemini-3.1-pro-low",
        "claude-sonnet-4-6",
    ];
    if allowed.contains(&requested.as_str()) {
        requested
    } else {
        DEFAULT_MODEL.into()
    }
}

fn redact_output(mut output: String) -> String {
    for key in [
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "DEEPGRAM_API_KEY",
        "SPEECHMATICS_API_KEY",
        "ASSEMBLYAI_API_KEY",
        "AZURE_SPEECH_KEY",
    ] {
        if let Ok(secret) = env::var(key) {
            if !secret.is_empty() {
                output = output.replace(&secret, "[REDACTED]");
            }
        }
    }
    if output.len() > MAX_OUTPUT_LEN {
        output.truncate(MAX_OUTPUT_LEN);
        output.push_str("\n[output truncated]");
    }
    output
}

fn update_job(
    jobs: &Arc<Mutex<HashMap<String, AgyJob>>>,
    id: &str,
    update: impl FnOnce(&mut AgyJob),
) {
    if let Ok(mut guard) = jobs.lock() {
        if let Some(job) = guard.get_mut(id) {
            update(job);
        }
    }
}

#[tauri::command]
pub fn list_agy_agents() -> Vec<AgyAgentDescriptor> {
    catalog()
}

#[tauri::command]
pub fn start_agy_agent(
    state: State<'_, AgyState>,
    agent: String,
    task: String,
) -> Result<AgyJob, String> {
    if !is_allowed_agent(&agent) {
        return Err("Unknown AGY agent".into());
    }
    let task = task.trim().to_string();
    if task.is_empty() {
        return Err("Task is required".into());
    }
    if task.len() > MAX_TASK_LEN {
        return Err(format!("Task is too long (max {} chars)", MAX_TASK_LEN));
    }
    if task.chars().any(|c| c == '\0' || c == '\r') {
        return Err("Task contains forbidden control characters".into());
    }
    let cwd = workspace()?;

    // Concurrency cap
    {
        let guard = state
            .jobs
            .lock()
            .map_err(|_| "AGY state lock poisoned".to_string())?;
        let running = guard.values().filter(|job| job.status == "running").count();
        if running >= MAX_RUNNING_JOBS {
            audit(
                &cwd,
                "rejected_concurrency_limit",
                "pending",
                &agent,
                &format!("{} running", running),
            );
            return Err(format!(
                "{} AGY job(s) already running; cancel or wait",
                running
            ));
        }
    }

    let id = format!(
        "agy-{}-{}",
        now(),
        NEXT_JOB_ID.fetch_add(1, Ordering::Relaxed)
    );
    let preview = task.chars().take(160).collect::<String>();
    let job = AgyJob {
        id: id.clone(),
        agent: agent.clone(),
        status: "queued".into(),
        task_preview: preview,
        output: String::new(),
        exit_code: None,
        started_at: None,
        finished_at: None,
    };
    let jobs = state.jobs.clone();
    let children = state.children.clone();
    jobs.lock()
        .map_err(|_| "AGY state lock poisoned".to_string())?
        .insert(id.clone(), job.clone());
    audit(
        &cwd,
        "started",
        &id,
        &agent,
        &task.chars().take(120).collect::<String>(),
    );

    tauri::async_runtime::spawn(async move {
        update_job(&jobs, &id, |job| {
            job.status = "running".into();
            job.started_at = Some(now());
        });
        let descriptor = catalog().iter().find(|item| item.id == agent).cloned();
        let (read_only, owned_paths) = descriptor
            .as_ref()
            .map(|item| (item.read_only, item.owned_paths.join(", ")))
            .unwrap_or((true, String::new()));
        let prompt = format!(
            "Work in {} only. Allowed paths: {}. Use the selected custom agent instructions.\n\nTask:\n{}\n\nSafety: preserve unrelated changes; no Telegram write/live operations; no login; no secrets; run bounded verification and report exact evidence.",
            cwd.display(), owned_paths, task
        );
        let mut command = Command::new("agy");
        command
            .arg("--agent")
            .arg(&agent)
            .arg("--model")
            .arg(model());
        if read_only {
            command.arg("--mode").arg("plan");
        }
        let result = command
            .arg("--print-timeout")
            .arg(PRINT_TIMEOUT)
            .arg(format!("--print={}", prompt))
            .current_dir(&cwd)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn();

        match result {
            Ok(mut child) => {
                let mut stdout = child.stdout.take().expect("agy child stdout must be piped");
                let mut stderr = child.stderr.take().expect("agy child stderr must be piped");
                let child = Arc::new(AsyncMutex::new(child));
                children
                    .lock()
                    .ok()
                    .map(|mut guard| guard.insert(id.clone(), child.clone()));

                // Drain pipes concurrently so the child never blocks on them.
                let out_task = tauri::async_runtime::spawn(async move {
                    let mut buffer = String::new();
                    let _ = tokio::io::AsyncReadExt::read_to_string(&mut stdout, &mut buffer).await;
                    buffer
                });
                let err_task = tauri::async_runtime::spawn(async move {
                    let mut buffer = String::new();
                    let _ = tokio::io::AsyncReadExt::read_to_string(&mut stderr, &mut buffer).await;
                    buffer
                });

                let wait_result = timeout(Duration::from_secs(JOB_TIMEOUT_SECS), async {
                    child.lock().await.wait().await
                })
                .await;

                match wait_result {
                    Ok(Ok(status)) => {
                        let combined = format!(
                            "{}\n[stderr]\n{}",
                            out_task.await.unwrap_or_default(),
                            err_task.await.unwrap_or_default()
                        );
                        let code = status.code();
                        update_job(&jobs, &id, |job| {
                            job.status = if status.success() {
                                "done".into()
                            } else {
                                "failed".into()
                            };
                            job.exit_code = code;
                            job.output = redact_output(combined);
                            job.finished_at = Some(now());
                        });
                        audit(&cwd, "finished", &id, &agent, &format!("exit={:?}", code));
                    }
                    Ok(Err(error)) => {
                        update_job(&jobs, &id, |job| {
                            job.status = "failed".into();
                            job.output = format!("AGY launch failed: {}", error);
                            job.finished_at = Some(now());
                        });
                        audit(&cwd, "failed", &id, &agent, &format!("{}", error));
                    }
                    Err(_) => {
                        let mut guard = child.lock().await;
                        let _ = guard.start_kill();
                        update_job(&jobs, &id, |job| {
                            job.status = "timeout".into();
                            job.output =
                                format!("Job exceeded {}s and was killed", JOB_TIMEOUT_SECS);
                            job.finished_at = Some(now());
                        });
                        audit(
                            &cwd,
                            "timeout_kill",
                            &id,
                            &agent,
                            &format!("{}s", JOB_TIMEOUT_SECS),
                        );
                    }
                }

                if let Ok(mut guard) = children.lock() {
                    guard.remove(&id);
                }
            }
            Err(error) => {
                update_job(&jobs, &id, |job| {
                    job.status = "failed".into();
                    job.output = format!("AGY launch failed: {}", error);
                    job.finished_at = Some(now());
                });
                audit(&cwd, "launch_error", &id, &agent, &format!("{}", error));
            }
        }
    });
    Ok(job)
}

#[tauri::command]
pub async fn cancel_agy_agent(state: State<'_, AgyState>, job_id: String) -> Result<bool, String> {
    let handle = {
        let guard = state
            .children
            .lock()
            .map_err(|_| "AGY state lock poisoned".to_string())?;
        guard.get(&job_id).cloned()
    };
    let Some(child) = handle else {
        return Ok(false);
    };
    let mut guard = child.lock().await;
    let _ = guard.start_kill();
    if let Ok(guard) = state.jobs.lock() {
        if let Some(job) = guard.get(&job_id) {
            audit(
                &workspace().unwrap_or_default(),
                "cancelled",
                &job_id,
                &job.agent,
                "requested by user",
            );
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn get_agy_job(state: State<'_, AgyState>, job_id: String) -> Result<Option<AgyJob>, String> {
    let guard = state
        .jobs
        .lock()
        .map_err(|_| "AGY state lock poisoned".to_string())?;
    Ok(guard.get(&job_id).cloned())
}
