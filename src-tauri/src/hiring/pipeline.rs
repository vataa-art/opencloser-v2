//! Pipeline moves with exit-criteria enforcement (§7 `pipeline_move`).
//! The criteria table lives in `hiring_core::pipeline::validate_move`;
//! this file gathers the `MoveContext` flags from DB truth, rejects with
//! the structured `ValidatorError`, and persists the move.

use serde::Serialize;
use tauri::AppHandle;

use hiring_core::error::ValidatorError;
use hiring_core::pipeline::{validate_move, MoveContext, Stage};
use hiring_core::types::{Grade, Scorecard};

use super::{internal, not_found, open_db, optional_row, parse_json_list};

#[derive(Serialize)]
pub struct MoveResult {
    pub candidate_id: String,
    pub vacancy_id: String,
    pub stage: String,
}

/// `steps_completed` JSON covers the nine required screening flow steps.
fn steps_cover_all_9(raw: &str) -> bool {
    let steps: Vec<String> = parse_json_list(raw);
    (1..=9).all(|n| steps.iter().any(|s| s == &n.to_string()))
}

/// Best scorecard total across this (candidate, vacancy) screening
/// sessions, graded via `Grade::from_total`; `None` when none exists.
fn load_scorecard(
    conn: &rusqlite::Connection,
    candidate_id: &str,
    vacancy_id: &str,
) -> Result<Option<Scorecard>, ValidatorError> {
    let best: Option<i64> = conn
        .query_row(
            "SELECT MAX(s.total) FROM scorecards s \
             JOIN screening_sessions ss ON s.session_id = ss.id \
             WHERE ss.candidate_id = ?1 AND ss.vacancy_id = ?2",
            [candidate_id, vacancy_id],
            |row| row.get(0),
        )
        .map_err(internal)?;
    Ok(best.map(|total| Scorecard { total, grade: Grade::from_total(total) }))
}

/// Move a candidate within a vacancy pipeline, enforcing the exit criteria
/// from spec §2 via `hiring_core::pipeline::validate_move`. The rejection
/// is returned AS the command error, so the invoke promise rejects with
/// `{ code, missing, message }` (e.g. submitted without a scorecard →
/// `EXIT_CRITERIA_UNMET`, missing contains `scorecard` + `grade_gte_B`).
///
/// Touch-derived flags (reply_received, contact_attempts, slot_confirmed)
/// have no data source in iter-5 and are fixed to their unmet defaults.
#[tauri::command]
pub fn pipeline_move(
    app: AppHandle,
    candidate_id: String,
    vacancy_id: String,
    to_stage: String,
) -> Result<MoveResult, ValidatorError> {
    let to = Stage::from_str(&to_stage)
        .ok_or_else(|| ValidatorError::validation(vec!["stage".to_string()]))?;

    let conn = open_db(&app)?;

    let (contacts, source): (String, String) = conn
        .query_row(
            "SELECT contacts, source FROM candidates WHERE id = ?1",
            [&candidate_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                ))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => not_found("candidate", &candidate_id),
            other => internal(other),
        })?;

    let vacancy_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM vacancies WHERE id = ?1",
            [&vacancy_id],
            |row| row.get(0),
        )
        .map_err(internal)?;
    if vacancy_exists == 0 {
        return Err(not_found("vacancy", &vacancy_id));
    }

    let pipeline: Option<(String, Option<String>)> = optional_row(conn.query_row(
        "SELECT stage, reject_reason FROM candidate_pipeline \
         WHERE candidate_id = ?1 AND vacancy_id = ?2",
        [&candidate_id, &vacancy_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ))?;

    // Entry point: first link of a candidate to a vacancy creates the
    // implicit "sourced" row (spec §2 "Sourced — Candidate linked to
    // vacancy") without further exit criteria.
    if matches!(to, Stage::Sourced) && pipeline.is_none() {
        conn.execute(
            "INSERT INTO candidate_pipeline (id, candidate_id, vacancy_id, stage, entered_at, owner) \
             VALUES (?1, ?2, ?3, 'sourced', datetime('now'), NULL)",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), candidate_id, vacancy_id],
        )
        .map_err(internal)?;
        return Ok(MoveResult {
            candidate_id,
            vacancy_id,
            stage: to.as_str().to_string(),
        });
    }

    // Ground the move in DB truth.
    let sessions: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT steps_completed FROM screening_sessions \
                 WHERE candidate_id = ?1 AND vacancy_id = ?2",
            )
            .map_err(internal)?;
        let rows = stmt
            .query_map([&candidate_id, &vacancy_id], |row| row.get::<_, String>(0))
            .map_err(internal)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(internal)?
    };

    let (from, reject_reason) = match &pipeline {
        Some((stage, reason)) => (Stage::from_str(stage).unwrap_or(Stage::Sourced), reason.clone()),
        None => (Stage::Sourced, None),
    };

    let ctx = MoveContext {
        from,
        to,
        has_contact: !parse_json_list::<hiring_core::types::Contact>(&contacts).is_empty(),
        has_source: !source.trim().is_empty(),
        reply_received: false, // no touch data in iter-5
        contact_attempts: 0,   // no touch data in iter-5
        required_flow_steps_done: sessions.iter().any(|raw| steps_cover_all_9(raw)),
        call_finished: !sessions.is_empty(),
        scorecard: load_scorecard(&conn, &candidate_id, &vacancy_id)?,
        slot_confirmed: false, // no scheduling data in iter-5
        reject_reason,
    };

    // Unmet exit criteria → the ValidatorError itself is the command error.
    validate_move(&ctx)?;

    match pipeline {
        // Keep reject_reason as-is on stage updates.
        Some(_) => {
            conn.execute(
                "UPDATE candidate_pipeline SET stage = ?1, entered_at = datetime('now') \
                 WHERE candidate_id = ?2 AND vacancy_id = ?3",
                rusqlite::params![to.as_str(), candidate_id, vacancy_id],
            )
            .map_err(internal)?;
        }
        None => {
            conn.execute(
                "INSERT INTO candidate_pipeline (id, candidate_id, vacancy_id, stage, entered_at, owner) \
                 VALUES (?1, ?2, ?3, ?4, datetime('now'), NULL)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    candidate_id,
                    vacancy_id,
                    to.as_str(),
                ],
            )
            .map_err(internal)?;
        }
    }

    Ok(MoveResult {
        candidate_id,
        vacancy_id,
        stage: to.as_str().to_string(),
    })
}
