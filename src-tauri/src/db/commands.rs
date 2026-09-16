use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Manager};

const ALLOWED_LEAD_STATUSES: &[&str] = &["Discovery", "Outbound Call", "Audit Requested", "Closed"];

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir unavailable: {}", e))?;
    let conn = Connection::open(app_dir.join("opencloser.db")).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[derive(Serialize)]
pub struct Lead {
    pub id: String,
    pub name: String,
    pub company: String,
    pub phone: String,
    pub email: String,
    pub title: String,
    pub linkedin_url: String,
    pub notes: String,
    pub industry: String,
    pub status: String,
    pub score: i32,
    pub created_at: String,
    pub dnc: i32,
    pub consent_at: Option<String>,
    pub opted_out_at: Option<String>,
}

#[tauri::command]
pub fn get_leads(app: AppHandle) -> Result<Vec<Lead>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare("SELECT id, name, company, phone, email, title, linkedin_url, notes, industry, status, score, created_at, COALESCE(dnc, 0), consent_at, opted_out_at FROM leads ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let lead_iter = stmt
        .query_map([], |row| {
            Ok(Lead {
                id: row.get(0)?,
                name: row.get(1)?,
                company: row.get(2)?,
                phone: row.get(3)?,
                email: row.get::<_, String>(4).unwrap_or_default(),
                title: row.get::<_, String>(5).unwrap_or_default(),
                linkedin_url: row.get::<_, String>(6).unwrap_or_default(),
                notes: row.get::<_, String>(7).unwrap_or_default(),
                industry: row.get::<_, String>(8).unwrap_or_default(),
                status: row.get(9)?,
                score: row.get(10)?,
                created_at: row.get(11)?,
                dnc: row.get::<_, i32>(12).unwrap_or(0),
                consent_at: row.get::<_, Option<String>>(13).ok().flatten(),
                opted_out_at: row.get::<_, Option<String>>(14).ok().flatten(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut leads = Vec::new();
    for lead in lead_iter {
        leads.push(lead.map_err(|e| e.to_string())?);
    }

    Ok(leads)
}

#[tauri::command]
pub fn update_lead_status(app: AppHandle, id: String, status: String) -> Result<(), String> {
    let conn = open_db(&app)?;

    if !ALLOWED_LEAD_STATUSES.contains(&status.as_str()) {
        return Err(format!(
            "Invalid lead status '{}'. Allowed: {}",
            status,
            ALLOWED_LEAD_STATUSES.join(", ")
        ));
    }

    conn.execute("UPDATE leads SET status = ?1 WHERE id = ?2", [&status, &id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(serde::Deserialize)]
pub struct NewLead {
    pub id: String,
    pub name: String,
    pub company: String,
    pub phone: String,
    pub score: i32,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
}

#[tauri::command]
pub fn add_leads(app: AppHandle, leads: Vec<NewLead>) -> Result<usize, String> {
    let mut conn = open_db(&app)?;

    let mut inserted_count = 0;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    {
        let mut insert_stmt = tx.prepare(
            "INSERT OR IGNORE INTO leads (id, name, company, phone, email, title, linkedin_url, industry, status, score)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Discovery', ?9)",
        )
        .map_err(|e| e.to_string())?;

        for lead in leads {
            // The unique index on phone is the hard guarantee against
            // duplicates; INSERT OR IGNORE makes re-runs idempotent.
            let inserted = insert_stmt
                .execute(rusqlite::params![
                    lead.id,
                    lead.name,
                    lead.company,
                    lead.phone,
                    lead.email.as_deref().unwrap_or(""),
                    lead.title.as_deref().unwrap_or(""),
                    lead.linkedin_url.as_deref().unwrap_or(""),
                    lead.industry.as_deref().unwrap_or(""),
                    lead.score,
                ])
                .map_err(|e| e.to_string())?;
            inserted_count += inserted;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(inserted_count)
}

#[derive(Serialize)]
pub struct CallLog {
    pub id: String,
    pub lead_id: String,
    pub duration_seconds: i32,
    pub transcript: String,
    pub status: String,
    pub sentiment: String,
    pub created_at: String,
    pub lead_name: Option<String>,
    pub lead_company: Option<String>,
}

#[tauri::command]
pub fn get_call_logs(app: AppHandle) -> Result<Vec<CallLog>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.lead_id, c.duration_seconds, c.transcript, c.status, COALESCE(c.sentiment,'Neutral'), c.created_at, l.name as lead_name, l.company as lead_company 
             FROM call_logs c 
             LEFT JOIN leads l ON c.lead_id = l.id 
             ORDER BY c.created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(CallLog {
                id: row.get(0)?,
                lead_id: row.get(1)?,
                duration_seconds: row.get(2)?,
                transcript: row.get(3)?,
                status: row.get(4)?,
                sentiment: row.get::<_, String>(5).unwrap_or_else(|_| "Neutral".into()),
                created_at: row.get(6)?,
                lead_name: row.get(7).ok(),
                lead_company: row.get(8).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

#[tauri::command]
pub fn add_call_log(
    app: AppHandle,
    id: String,
    lead_id: String,
    duration_seconds: i32,
    transcript: String,
    status: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    refuse_if_not_callable(&conn, &lead_id, false)?;

    conn.execute(
        "INSERT INTO call_logs (id, lead_id, duration_seconds, transcript, status) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, lead_id, duration_seconds, transcript, status],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_lead_call_logs(app: AppHandle, lead_id: String) -> Result<Vec<CallLog>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.lead_id, c.duration_seconds, c.transcript, c.status, COALESCE(c.sentiment,'Neutral'), c.created_at, l.name, l.company
             FROM call_logs c
             LEFT JOIN leads l ON c.lead_id = l.id
             WHERE c.lead_id = ?1
             ORDER BY c.created_at DESC"
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([&lead_id], |row| {
            Ok(CallLog {
                id: row.get(0)?,
                lead_id: row.get(1)?,
                duration_seconds: row.get(2)?,
                transcript: row.get(3)?,
                status: row.get(4)?,
                sentiment: row.get::<_, String>(5).unwrap_or_else(|_| "Neutral".into()),
                created_at: row.get(6)?,
                lead_name: row.get(7).ok(),
                lead_company: row.get(8).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }

    Ok(logs)
}

#[derive(Serialize)]
pub struct LeadNote {
    pub id: String,
    pub lead_id: String,
    pub content: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_lead_notes(app: AppHandle, lead_id: String) -> Result<Vec<LeadNote>, String> {
    let conn = open_db(&app)?;

    let mut stmt = conn
        .prepare("SELECT id, lead_id, content, created_at FROM lead_notes WHERE lead_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([&lead_id], |row| {
            Ok(LeadNote {
                id: row.get(0)?,
                lead_id: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }

    Ok(notes)
}

#[tauri::command]
pub fn add_lead_note(
    app: AppHandle,
    id: String,
    lead_id: String,
    content: String,
) -> Result<(), String> {
    let conn = open_db(&app)?;

    conn.execute(
        "INSERT INTO lead_notes (id, lead_id, content) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, lead_id, content],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_lead(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_db(&app)?;

    conn.execute("DELETE FROM lead_notes WHERE lead_id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM call_logs WHERE lead_id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activities WHERE lead_id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM leads WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn load_compliance(
    conn: &Connection,
    id: &str,
) -> Result<(i32, Option<String>, Option<String>), String> {
    conn.query_row(
        "SELECT COALESCE(dnc, 0), consent_at, opted_out_at FROM leads WHERE id = ?1",
        [id],
        |row| {
            Ok((
                row.get::<_, i32>(0).unwrap_or(0),
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        },
    )
    .map_err(|_| format!("Lead not found: {}", id))
}

fn refuse_if_not_callable(conn: &Connection, id: &str, live: bool) -> Result<(), String> {
    let (dnc, consent_at, opted_out_at) = load_compliance(conn, id)?;
    if live {
        crate::db::compliance::assert_live_callable(
            dnc,
            opted_out_at.as_deref(),
            consent_at.as_deref(),
        )
    } else {
        crate::db::compliance::assert_callable(dnc, opted_out_at.as_deref())
    }
}

#[tauri::command]
pub fn set_lead_compliance(
    app: AppHandle,
    id: String,
    dnc: bool,
    consent: bool,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    let dnc_flag: i32 = if dnc { 1 } else { 0 };
    let consent_flag: i32 = if consent { 1 } else { 0 };
    let updated = conn
        .execute(
            "UPDATE leads SET
                dnc = ?1,
                opted_out_at = CASE WHEN ?1 = 1 THEN datetime('now') ELSE NULL END,
                consent_at = CASE WHEN ?2 = 1 THEN datetime('now') ELSE NULL END
             WHERE id = ?3",
            rusqlite::params![dnc_flag, consent_flag, id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err(format!("Lead not found: {}", id));
    }
    Ok(())
}

#[tauri::command]
pub fn assert_lead_callable(app: AppHandle, id: String, live: bool) -> Result<(), String> {
    let conn = open_db(&app)?;
    refuse_if_not_callable(&conn, &id, live)
}
