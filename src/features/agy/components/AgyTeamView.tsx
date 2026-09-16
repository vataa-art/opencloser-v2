import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bot, CheckCircle2, Clock3, Loader2, Play, ShieldCheck, XCircle } from "lucide-react";

type AgyAgent = {
  id: string;
  description: string;
  ownedPaths: string[];
  readOnly: boolean;
};

type AgyJob = {
  id: string;
  agent: string;
  status: "queued" | "running" | "done" | "failed";
  taskPreview: string;
  output: string;
  exitCode: number | null;
  startedAt: number | null;
  finishedAt: number | null;
};

const STATUS_LABEL: Record<AgyJob["status"], string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

export function AgyTeamView() {
  const [agents, setAgents] = useState<AgyAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("goal-explorer");
  const [task, setTask] = useState("");
  const [job, setJob] = useState<AgyJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<AgyAgent[]>("list_agy_agents")
      .then((items) => {
        setAgents(items);
        if (items[0]) setSelectedAgent(items[0].id);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      invoke<AgyJob | null>("get_agy_job", { jobId: job.id })
        .then((updated) => updated && setJob(updated))
        .catch((err) => setError(String(err)));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  const start = async () => {
    if (!task.trim() || starting) return;
    setStarting(true);
    setError("");
    try {
      const created = await invoke<AgyJob>("start_agy_agent", {
        agent: selectedAgent,
        task: task.trim(),
      });
      setJob(created);
    } catch (err) {
      setError(String(err));
    } finally {
      setStarting(false);
    }
  };

  const selected = agents.find((agent) => agent.id === selectedAgent);
  const status = job ? STATUS_LABEL[job.status] : "No active job";

  return (
    <div className="min-h-full px-8 py-8" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#1A1D20] text-white shadow-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">AGY Agent Team</h1>
                <p className="text-sm text-gray-500 mt-1">Паралельні worker-и для OpenCloser і `/goal`</p>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5" /> allowlist · read-only Telegram
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Запустити субагента</h2>
                <p className="text-xs text-gray-500 mt-1">OpenCloser передає тільки allowlisted роль і текст задачі.</p>
              </div>
              <Clock3 className="w-5 h-5 text-gray-400" />
            </div>

            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2" htmlFor="agy-agent">Роль</label>
            <select
              id="agy-agent"
              value={selectedAgent}
              onChange={(event) => setSelectedAgent(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-gray-400"
              disabled={loading || starting}
            >
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.id}</option>)}
            </select>
            {selected && <p className="mt-2 text-xs leading-relaxed text-gray-500">{selected.description} · {selected.ownedPaths.join(", ")}</p>}

            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mt-5 mb-2" htmlFor="agy-task">Задача</label>
            <textarea
              id="agy-task"
              value={task}
              onChange={(event) => setTask(event.target.value)}
              placeholder="Наприклад: перевір voice stack, додай focused tests і поверни точні результати."
              rows={7}
              maxLength={12000}
              className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-900 outline-none focus:border-gray-400"
              disabled={starting}
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400"><span>Максимум 12 000 символів</span><span>{task.length}/12000</span></div>

            <button
              type="button"
              onClick={() => void start()}
              disabled={!task.trim() || starting || loading}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1A1D20] px-4 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Запустити AGY worker
            </button>
            {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Job status</h2>
                <p className="text-xs text-gray-500 mt-1">Статус оновлюється кожні 1.5 секунди.</p>
              </div>
              {job?.status === "running" && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
              {job?.status === "done" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {job?.status === "failed" && <XCircle className="w-5 h-5 text-red-500" />}
            </div>
            {!job ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">Запусти роль — тут з’явиться job і її evidence.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                  <div><div className="font-mono text-xs font-bold text-gray-800">{job.id}</div><div className="mt-1 text-xs text-gray-500">{job.agent}</div></div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${job.status === "done" ? "bg-emerald-100 text-emerald-700" : job.status === "failed" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{status}</span>
                </div>
                <div><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Task preview</div><p className="text-sm leading-relaxed text-gray-700">{job.taskPreview}</p></div>
                <div><div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Output</div><pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#111315] p-4 text-[11px] leading-relaxed text-gray-200">{job.output || (job.status === "running" ? "AGY працює…" : "No output")}</pre></div>
                {job.exitCode !== null && <div className="text-xs text-gray-500">exit code: <span className={job.exitCode === 0 ? "text-emerald-600" : "text-red-600"}>{job.exitCode}</span></div>}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          AGY запускається локально через `agy --agent`; OpenCloser не приймає довільні shell-команди. Telegram write/live-операції, логін і `--dangerously-skip-permissions` через цей екран не вмикаються.
        </div>
      </div>
    </div>
  );
}
