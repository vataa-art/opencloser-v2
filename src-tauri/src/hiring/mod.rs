//! Tauri command layer for the P1 hiring vertical, iteration 5
//! (P1-RECRUITMENT-HIRING.md §7): vacancy create + KB publish, candidate
//! upsert with contact dedupe, and pipeline moves with exit-criteria
//! enforcement. All pure logic lives in `hiring-core`; this module only
//! maps SQLite rows to domain types and back.
//!
//! Command errors are always `ValidatorError`, so Tauri serializes the
//! rejection as `{ code, missing, message }` — the frontend
//! `isHiringError` guard matches that shape (never a bare string).

pub mod candidate;
pub mod pipeline;
pub mod vacancy;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use hiring_core::error::ValidatorError;

/// KB domain for hiring documents — deliberately distinct from the
/// Academy course seed, which stays under `domain="recruitment"`.
pub(crate) const HIRING_KB_DOMAIN: &str = "recruitment_hiring";

// ── Shared error plumbing ───────────────────────────────────────────────

/// Unexpected backend failure (DB / IO / embedding). Carries no `missing`
/// items — that list is only for validation and exit-criteria feedback.
pub(crate) fn internal(message: impl std::fmt::Display) -> ValidatorError {
    ValidatorError {
        code: "INTERNAL".into(),
        missing: vec![],
        message: message.to_string(),
    }
}

/// A referenced entity does not exist (404-style, structured like every
/// other hiring error so the UI can branch on `code`).
pub(crate) fn not_found(entity: &str, id: &str) -> ValidatorError {
    ValidatorError {
        code: "NOT_FOUND".into(),
        missing: vec![entity.to_string()],
        message: format!("{entity} not found: {id}"),
    }
}

/// Payload that failed serde deserialization into a hiring input struct.
pub(crate) fn invalid_payload(context: &str, e: serde_json::Error) -> ValidatorError {
    ValidatorError {
        code: "VALIDATION_FAILED".into(),
        missing: vec!["payload".to_string()],
        message: format!("invalid {context} payload: {e}"),
    }
}

// ── Shared DB / JSON helpers ────────────────────────────────────────────

/// Per-call DB open — same pattern as `db::commands` / `ai::kb`.
pub(crate) fn open_db(app: &AppHandle) -> Result<Connection, ValidatorError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| internal(format!("App data dir unavailable: {}", e)))?;
    let conn = Connection::open(app_dir.join("opencloser.db")).map_err(internal)?;
    conn.pragma_update(None, "foreign_keys", "ON").map_err(internal)?;
    Ok(conn)
}

/// `QueryReturnedNoRows` → `Ok(None)`; anything else is an internal error.
pub(crate) fn optional_row<T>(result: Result<T, rusqlite::Error>) -> Result<Option<T>, ValidatorError> {
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(internal(e)),
    }
}

/// Parse a JSON list column, defaulting to empty on malformed data.
pub(crate) fn parse_json_list<T: serde::de::DeserializeOwned>(raw: &str) -> Vec<T> {
    serde_json::from_str(raw).unwrap_or_default()
}

pub(crate) fn json_string(items: &[String]) -> Result<String, ValidatorError> {
    serde_json::to_string(items).map_err(internal)
}

pub(crate) fn flag(b: bool) -> i32 {
    if b {
        1
    } else {
        0
    }
}
