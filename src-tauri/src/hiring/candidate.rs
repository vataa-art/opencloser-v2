//! Candidate upsert with contact dedupe (§7 `candidate_upsert`).
//! Dedupe logic itself is `hiring_core::dedupe`; this file only loads the
//! existing contact lists, routes INSERT vs UPDATE, and shapes the result.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use hiring_core::dedupe::find_duplicate_contact;
use hiring_core::error::ValidatorError;
use hiring_core::types::Contact;

use super::{flag, internal, invalid_payload, json_string, open_db, parse_json_list};

/// Candidate payload from CandidateCard. Missing optional fields default
/// to empty; `consent_data_at` is derived server-side (now, when consent
/// is recorded).
#[derive(Deserialize, Default)]
#[serde(default)]
struct CandidatePayload {
    full_name: String,
    contacts: Vec<Contact>,
    source: String,
    current_role: String,
    years_exp: f64,
    stack: Vec<String>,
    salary_expectation: String,
    notice_period: String,
    work_format_pref: String,
    english_level: String,
    dnc: bool,
    consent_recording: bool,
}

#[derive(Serialize)]
pub struct UpsertResult {
    pub id: String,
    pub deduped: bool,
}

/// Upsert a candidate, deduped by normalized contact
/// (`hiring_core::dedupe`): a hit updates the existing row and returns its
/// id with `deduped: true`; otherwise a new uuid row is inserted.
#[tauri::command]
pub fn candidate_upsert(app: AppHandle, payload: Value) -> Result<UpsertResult, ValidatorError> {
    let input: CandidatePayload =
        serde_json::from_value(payload).map_err(|e| invalid_payload("candidate", e))?;
    if input.contacts.is_empty() {
        return Err(ValidatorError::validation(vec!["contacts".to_string()]));
    }

    let conn = open_db(&app)?;

    // Existing candidates for dedupe comparison (id + contacts JSON).
    let mut existing_ids: Vec<String> = Vec::new();
    let mut existing_contacts: Vec<Vec<Contact>> = Vec::new();
    {
        let mut stmt = conn
            .prepare("SELECT id, contacts FROM candidates")
            .map_err(internal)?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(internal)?;
        for row in rows {
            let (id, raw) = row.map_err(internal)?;
            existing_ids.push(id);
            existing_contacts.push(parse_json_list::<Contact>(&raw));
        }
    }

    let contacts_json = serde_json::to_string(&input.contacts).map_err(internal)?;
    let stack_json = json_string(&input.stack)?;

    match find_duplicate_contact(&existing_contacts, &input.contacts) {
        Some(index) => {
            let id = existing_ids[index].clone();
            conn.execute(
                "UPDATE candidates SET full_name = ?1, contacts = ?2, source = ?3, \
                 current_role = ?4, years_exp = ?5, stack = ?6, salary_expectation = ?7, \
                 notice_period = ?8, work_format_pref = ?9, english_level = ?10, dnc = ?11, \
                 consent_recording = ?12 WHERE id = ?13",
                rusqlite::params![
                    input.full_name,
                    contacts_json,
                    input.source,
                    input.current_role,
                    input.years_exp,
                    stack_json,
                    input.salary_expectation,
                    input.notice_period,
                    input.work_format_pref,
                    input.english_level,
                    flag(input.dnc),
                    flag(input.consent_recording),
                    id,
                ],
            )
            .map_err(internal)?;
            Ok(UpsertResult { id, deduped: true })
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO candidates (id, full_name, contacts, source, current_role, \
                 years_exp, stack, salary_expectation, notice_period, work_format_pref, \
                 english_level, dnc, consent_recording, consent_data_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, \
                 CASE WHEN ?13 = 1 THEN datetime('now') ELSE NULL END)",
                rusqlite::params![
                    id,
                    input.full_name,
                    contacts_json,
                    input.source,
                    input.current_role,
                    input.years_exp,
                    stack_json,
                    input.salary_expectation,
                    input.notice_period,
                    input.work_format_pref,
                    input.english_level,
                    flag(input.dnc),
                    flag(input.consent_recording),
                ],
            )
            .map_err(internal)?;
            Ok(UpsertResult { id, deduped: false })
        }
    }
}
