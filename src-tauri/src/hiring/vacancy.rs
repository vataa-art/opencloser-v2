//! Vacancy commands: intake creation (§7 `vacancy_create`) and publishing
//! the rendered vacancy card into the hiring KB domain
//! (§7 `vacancy_publish_to_kb`).

use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;

use hiring_core::card::render_vacancy_card;
use hiring_core::error::ValidatorError;
use hiring_core::types::Vacancy;
use hiring_core::validate::validate_vacancy;

use super::{internal, invalid_payload, json_string, not_found, open_db, optional_row, parse_json_list, HIRING_KB_DOMAIN};
use crate::ai::kb::{self, KbIngestResult};

/// Vacancy payload from the VacancyIntake wizard. Wizard-optional fields
/// default to empty so validation collects everything that is missing;
/// `id` / `status` are assigned server-side and ignored from the payload.
#[derive(Deserialize, Default)]
#[serde(default)]
struct VacancyPayload {
    title: String,
    company: String,
    seniority: String,
    stack: Vec<String>,
    salary_min: i64,
    salary_max: i64,
    currency: String,
    work_format: String,
    location: String,
    english_level: String,
    must_have: Vec<String>,
    nice_to_have: Vec<String>,
    hiring_manager: String,
    sla_days: i64,
}

impl VacancyPayload {
    fn into_vacancy(self, id: String) -> Vacancy {
        Vacancy {
            id,
            title: self.title,
            company: self.company,
            seniority: self.seniority,
            stack: self.stack,
            salary_min: self.salary_min,
            salary_max: self.salary_max,
            currency: self.currency,
            work_format: self.work_format,
            location: self.location,
            english_level: self.english_level,
            must_have: self.must_have,
            nice_to_have: self.nice_to_have,
            hiring_manager: self.hiring_manager,
            sla_days: self.sla_days,
            status: "intake".to_string(),
        }
    }
}

/// Create a vacancy after `hiring_core::validate_vacancy` (Intake exit
/// criteria: must_have + salary fork + work_format + location +
/// hiring_manager + SLA, else `VALIDATION_FAILED` with the full list).
#[tauri::command]
pub fn vacancy_create(app: AppHandle, payload: Value) -> Result<Vacancy, ValidatorError> {
    let input: VacancyPayload =
        serde_json::from_value(payload).map_err(|e| invalid_payload("vacancy", e))?;

    // Server-side identity: fresh uuid, lifecycle starts at "intake".
    let vacancy = VacancyPayload::into_vacancy(input, uuid::Uuid::new_v4().to_string());
    validate_vacancy(&vacancy)?;

    let conn = open_db(&app)?;
    let stack_json = json_string(&vacancy.stack)?;
    let must_have_json = json_string(&vacancy.must_have)?;
    let nice_to_have_json = json_string(&vacancy.nice_to_have)?;
    conn.execute(
        "INSERT INTO vacancies (id, title, company, seniority, stack, salary_min, salary_max, \
         currency, work_format, location, english_level, must_have, nice_to_have, \
         hiring_manager, sla_days, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        rusqlite::params![
            vacancy.id,
            vacancy.title,
            vacancy.company,
            vacancy.seniority,
            stack_json,
            vacancy.salary_min,
            vacancy.salary_max,
            vacancy.currency,
            vacancy.work_format,
            vacancy.location,
            vacancy.english_level,
            must_have_json,
            nice_to_have_json,
            vacancy.hiring_manager,
            vacancy.sla_days,
            vacancy.status,
        ],
    )
    .map_err(internal)?;

    Ok(vacancy)
}

/// Load one vacancy row, reassembling the domain type (JSON list columns
/// are parsed back into `Vec<String>`; nullable columns default to empty).
fn load_vacancy(conn: &rusqlite::Connection, id: &str) -> Result<Option<Vacancy>, ValidatorError> {
    optional_row(conn.query_row(
        "SELECT id, title, company, seniority, stack, salary_min, salary_max, currency, \
         work_format, location, english_level, must_have, nice_to_have, hiring_manager, \
         sla_days, status FROM vacancies WHERE id = ?1",
        [id],
        |row| {
            Ok(Vacancy {
                id: row.get(0)?,
                title: row.get(1)?,
                company: row.get(2)?,
                seniority: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                stack: parse_json_list(&row.get::<_, String>(4)?),
                salary_min: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
                salary_max: row.get::<_, Option<i64>>(6)?.unwrap_or(0),
                currency: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                work_format: row.get(8)?,
                location: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                english_level: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                must_have: parse_json_list(&row.get::<_, String>(11)?),
                nice_to_have: parse_json_list(&row.get::<_, String>(12)?),
                hiring_manager: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                sla_days: row.get::<_, Option<i64>>(14)?.unwrap_or(0),
                status: row.get(15)?,
            })
        },
    ))
}

/// Render the deterministic vacancy card and ingest it through the existing
/// `kb_ingest_document` path with `domain="recruitment_hiring"`,
/// `doc_type="vacancy_card"`, and the chunk rows linked to the vacancy.
/// Re-publishing the same vacancy replaces its chunks (stable
/// `(domain, source)` key).
#[tauri::command]
pub async fn vacancy_publish_to_kb(
    app: AppHandle,
    vacancy_id: String,
) -> Result<KbIngestResult, ValidatorError> {
    let vacancy = {
        let conn = open_db(&app)?;
        load_vacancy(&conn, &vacancy_id)?.ok_or_else(|| not_found("vacancy", &vacancy_id))?
    };
    let card = render_vacancy_card(&vacancy);
    let source = format!("vacancy_card:{}", vacancy.id);

    // Reuse the existing ingest command directly: same chunking, embedding
    // and transactional replace semantics; the two new optional arguments
    // tag every chunk with this vacancy.
    kb::kb_ingest_document(
        app,
        HIRING_KB_DOMAIN.to_string(),
        source,
        card,
        None,
        None,
        Some(vacancy.id.clone()),
        Some("vacancy_card".to_string()),
    )
    .await
    .map_err(internal)
}
