use log::info;
use rusqlite::Connection;
use std::fs;
use tauri::{AppHandle, Manager};

/// Latest schema version. Bump this and add a migration step below for
/// every schema change; `PRAGMA user_version` tracks what has been applied.
const SCHEMA_VERSION: i64 = 7;

pub fn init(app_handle: &AppHandle) {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    }

    let db_path = app_dir.join("opencloser.db");
    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        ",
    )
    .expect("Failed to set pragmas");

    // Bring new databases straight to the latest shape.
    conn.execute_batch(BASE_SCHEMA)
        .expect("Failed to create database schema");

    // Apply versioned migrations for databases created by older builds.
    run_migrations(&conn);

    // Seed data if empty
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM leads", [], |row| row.get(0))
        .unwrap_or(0);

    if count == 0 {
        seed_data(&conn);
    } else {
        info!("Database already seeded with {} leads.", count);
    }

    // Knowledge base: seed recruitment transcripts on first launch.
    crate::ai::kb::seed_if_empty(&conn);
}

const BASE_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT DEFAULT '',
        title TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        industry TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Discovery',
        score INTEGER DEFAULT 0,
        dnc INTEGER NOT NULL DEFAULT 0,
        consent_at TEXT DEFAULT NULL,
        opted_out_at TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        provider TEXT DEFAULT 'gemini',
        duration_seconds INTEGER DEFAULT 0,
        transcript TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        sentiment TEXT DEFAULT 'Neutral',
        objections_handled TEXT DEFAULT '[]',
        emotion_log TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        query TEXT DEFAULT '',
        location TEXT DEFAULT '',
        target_criteria TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        leads_found INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lead_notes (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT DEFAULT '',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0,
        FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kb_chunks (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        source TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        dim INTEGER NOT NULL,
        embedder TEXT NOT NULL DEFAULT 'local-hash-256',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_kb_chunks_domain ON kb_chunks(domain, embedder);
";

fn user_version(conn: &Connection) -> i64 {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0)
}

fn set_user_version(conn: &Connection, version: i64) {
    // PRAGMA cannot be parameterized; the value is an internal constant.
    conn.execute_batch(&format!("PRAGMA user_version = {};", version))
        .expect("Failed to update schema version");
}

fn run_migrations(conn: &Connection) {
    let mut version = user_version(conn);
    if version >= SCHEMA_VERSION {
        return;
    }
    info!(
        "Migrating database schema from v{} to v{}",
        version, SCHEMA_VERSION
    );

    let safe_alter = |sql: &str| {
        // "Duplicate column" errors are expected on fresh databases that
        // already have the final shape; anything else is logged.
        if let Err(e) = conn.execute(sql, []) {
            log::debug!("Migration alter skipped ({}): {}", e, sql);
        }
    };

    // v0 → v1: enriched lead columns
    if version < 1 {
        safe_alter("ALTER TABLE leads ADD COLUMN email TEXT DEFAULT ''");
        safe_alter("ALTER TABLE leads ADD COLUMN title TEXT DEFAULT ''");
        safe_alter("ALTER TABLE leads ADD COLUMN linkedin_url TEXT DEFAULT ''");
        safe_alter("ALTER TABLE leads ADD COLUMN notes TEXT DEFAULT ''");
        safe_alter("ALTER TABLE leads ADD COLUMN industry TEXT DEFAULT ''");
        version = 1;
        set_user_version(conn, 1);
    }

    // v1 → v2: call log enrichment columns
    if version < 2 {
        safe_alter("ALTER TABLE call_logs ADD COLUMN provider TEXT DEFAULT 'gemini'");
        safe_alter("ALTER TABLE call_logs ADD COLUMN sentiment TEXT DEFAULT 'Neutral'");
        safe_alter("ALTER TABLE call_logs ADD COLUMN objections_handled TEXT DEFAULT '[]'");
        safe_alter("ALTER TABLE call_logs ADD COLUMN emotion_log TEXT DEFAULT '[]'");
        version = 2;
        set_user_version(conn, 2);
    }

    // v2 → v3: campaign enrichment columns
    if version < 3 {
        safe_alter("ALTER TABLE campaigns ADD COLUMN query TEXT DEFAULT ''");
        safe_alter("ALTER TABLE campaigns ADD COLUMN location TEXT DEFAULT ''");
        safe_alter("ALTER TABLE campaigns ADD COLUMN leads_found INTEGER DEFAULT 0");
        version = 3;
        set_user_version(conn, 3);
    }

    // v3 → v4: unique constraint on leads.phone (dedupe first — keep the
    // oldest row; FK cascades remove orphaned logs/notes of duplicates).
    if version < 4 {
        if let Err(e) = conn.execute(
            "DELETE FROM leads WHERE rowid NOT IN (
                SELECT MIN(rowid) FROM leads GROUP BY phone
            )",
            [],
        ) {
            log::warn!("Phone dedupe migration failed: {}", e);
        }
        if let Err(e) = conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)",
            [],
        ) {
            log::error!(
                "Could not create unique index on leads(phone): {} — \
                 resolve duplicate phones manually and reopen the app",
                e
            );
        }
        version = 4;
        set_user_version(conn, 4);
    }

    // v4 → v5: query-performance indexes
    if version < 5 {
        for index in [
            "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score)",
            "CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id)",
            "CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id)",
            "CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)",
        ] {
            safe_alter(index);
        }
        set_user_version(conn, 5);
    }

    // v5 → v6: DNC / opt-out / consent columns for the dialer gate.
    if version < 6 {
        safe_alter("ALTER TABLE leads ADD COLUMN dnc INTEGER NOT NULL DEFAULT 0");
        safe_alter("ALTER TABLE leads ADD COLUMN consent_at TEXT DEFAULT NULL");
        safe_alter("ALTER TABLE leads ADD COLUMN opted_out_at TEXT DEFAULT NULL");
        set_user_version(conn, 6);
    }

    // v6 → v7: knowledge base chunks for vector search.
    if version < 7 {
        if let Err(e) = conn.execute(
            "CREATE TABLE IF NOT EXISTS kb_chunks (
                id TEXT PRIMARY KEY,
                domain TEXT NOT NULL,
                source TEXT NOT NULL,
                text TEXT NOT NULL,
                embedding BLOB NOT NULL,
                dim INTEGER NOT NULL,
                embedder TEXT NOT NULL DEFAULT 'local-hash-256',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ) {
            log::error!("Failed to create kb_chunks: {}", e);
        }
        safe_alter("CREATE INDEX IF NOT EXISTS idx_kb_chunks_domain ON kb_chunks(domain, embedder)");
        set_user_version(conn, 7);
    }

    info!(
        "Database migrations completed at schema v{}.",
        user_version(conn)
    );
}

fn seed_data(conn: &Connection) {
    info!("Seeding initial demo data...");

    // Seed 10 leads with realistic data
    const SEED_LEADS: &[(&str, &str, &str, &str, &str, &str, &str, &str, i32)] = &[
        (
            "lead_1",
            "Sarah Jenkins",
            "Acme Heavy Industries",
            "+1 (512) 555-0101",
            "sarah@acmeheavy.com",
            "VP of Operations",
            "Construction & Engineering",
            "Discovery",
            85,
        ),
        (
            "lead_2",
            "Marcus Chen",
            "TechBridge Infrastructure",
            "+1 (415) 555-0102",
            "m.chen@techbridge.io",
            "CTO",
            "Technology",
            "Discovery",
            92,
        ),
        (
            "lead_3",
            "Elena Rodriguez",
            "Global Logistics Partners",
            "+1 (713) 555-0103",
            "erodriguez@globalogistics.com",
            "Director of Procurement",
            "Logistics",
            "Outbound Call",
            78,
        ),
        (
            "lead_4",
            "David Kim",
            "Apex Financial Services",
            "+1 (212) 555-0104",
            "dkim@apexfin.com",
            "CEO",
            "Financial Services",
            "Audit Requested",
            95,
        ),
        (
            "lead_5",
            "Rachel Torres",
            "MetroBuild Contractors",
            "+1 (512) 555-0105",
            "rtorres@metrobuild.com",
            "Director of Risk Management",
            "Construction",
            "Discovery",
            88,
        ),
        (
            "lead_6",
            "James O'Brien",
            "Pacific Trade Group",
            "+1 (503) 555-0106",
            "jobrien@pacifictrade.com",
            "VP of Supply Chain",
            "Import/Export",
            "Outbound Call",
            82,
        ),
        (
            "lead_7",
            "Priya Sharma",
            "NovaTech Solutions",
            "+1 (650) 555-0107",
            "psharma@novatech.io",
            "Head of Engineering",
            "Technology",
            "Audit Requested",
            91,
        ),
        (
            "lead_8",
            "Michael Chang",
            "East-West Manufacturing",
            "+1 (626) 555-0108",
            "mchang@eastwestmfg.com",
            "COO",
            "Manufacturing",
            "Discovery",
            76,
        ),
        (
            "lead_9",
            "Alex Thompson",
            "Standard Industrial Corp",
            "+1 (312) 555-0109",
            "athompson@standardindustrial.com",
            "CEO",
            "Industrial",
            "Closed",
            98,
        ),
        (
            "lead_10",
            "Lisa Park",
            "Summit Risk Advisors",
            "+1 (720) 555-0110",
            "lpark@summitrisk.com",
            "VP of Business Development",
            "Insurance",
            "Outbound Call",
            84,
        ),
    ];

    for (id, name, company, phone, email, title, industry, status, score) in SEED_LEADS {
        conn.execute(
            "INSERT INTO leads (id, name, company, phone, email, title, industry, status, score) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![id, name, company, phone, email, title, industry, status, score],
        )
        .expect("Failed to seed lead");
    }

    // Seed 3 call logs with realistic demo transcripts
    let call_1_transcript = serde_json::to_string(&serde_json::json!([
        {"role": "model", "text": "Hi David! This is the OpenCloser AI calling. I noticed Apex Financial is expanding their wealth management division — how are things going on that front?"},
        {"role": "user", "text": "We're growing fast, actually. But our current lead qualification process is completely manual. Takes forever."},
        {"role": "model", "text": "That's exactly the kind of friction we eliminate. If I could show you how to automatically qualify and score leads using AI — without hiring more SDRs — would that be worth 15 minutes?"},
        {"role": "user", "text": "Honestly, if you can cut our qualification time in half, I'm interested. What's the catch?"},
        {"role": "model", "text": "No catch — just results. We typically see a 3x improvement in qualified meetings within 30 days. Can I send you a calendar invite for next Tuesday to walk through a demo?"},
        {"role": "user", "text": "Tuesday works. Send it over and I'll take a look."},
        {"role": "model", "text": "Perfect. I'll send that right now. Thanks for your time, David — really looking forward to showing you what we can do."}
    ])).unwrap();

    let call_2_transcript = serde_json::to_string(&serde_json::json!([
        {"role": "model", "text": "Hi, this is OpenCloser AI calling for Elena Rodriguez at Global Logistics Partners."},
        {"role": "model", "text": "I'll try reaching out again next week. Have a great day."}
    ])).unwrap();

    let call_3_transcript = serde_json::to_string(&serde_json::json!([
        {"role": "model", "text": "Hi Alex! Great to connect — our team mentioned you were interested in scaling your outbound without adding headcount."},
        {"role": "user", "text": "That's right. We've got a team of 12 SDRs and each one can only make about 40 calls a day. The math isn't working anymore."},
        {"role": "model", "text": "Forty calls per rep per day is tough. Most enterprise teams we work with were in the same spot — until we helped them flip the model. Our AI handles the first 1,000 dials, qualifies every lead, and only hands over the meetings your team actually wants."},
        {"role": "user", "text": "Wait — 1,000 dials? How many meetings does that actually produce?"},
        {"role": "model", "text": "Consistently 15-25 qualified meetings per week per AI agent. And we deploy as many agents as you need, all running 24/7. Your SDRs only talk to real buyers."},
        {"role": "user", "text": "What's the integration look like with Salesforce? We're heavy Salesforce users."},
        {"role": "model", "text": "Native two-way sync. Leads, call recordings, transcripts, and disposition codes all flow automatically. Zero manual data entry."},
        {"role": "user", "text": "Alright — I'm impressed. Let's run a 30-day pilot. Can you get us set up by next Monday?"},
        {"role": "model", "text": "Absolutely. I'll have our implementation team reach out within the hour. Welcome aboard, Alex — this is going to be a game-changer for Standard Industrial."},
        {"role": "user", "text": "Looking forward to it. Thanks for the call."}
    ])).unwrap();

    let seed_calls: &[(&str, &str, i32, &str, &str)] = &[
        ("call_1", "lead_4", 512, &call_1_transcript, "Success"),
        ("call_2", "lead_3", 22, &call_2_transcript, "Voicemail"),
        ("call_3", "lead_9", 735, &call_3_transcript, "Success"),
    ];

    for (id, lead_id, duration, transcript, status) in seed_calls {
        conn.execute(
            "INSERT INTO call_logs (id, lead_id, duration_seconds, transcript, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, lead_id, duration, transcript, status],
        )
        .expect("Failed to seed call log");
    }

    // Seed sample notes for David Kim (lead_4) — the one with a call history
    conn.execute(
        "INSERT INTO lead_notes (id, lead_id, content) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "note_1", "lead_4",
            "David expressed strong interest in AI-powered lead qualification. He mentioned their current process is entirely manual and they're scaling fast. Follow-up demo scheduled for next Tuesday."
        ],
    ).ok();

    info!("Demo seed data complete: 10 leads, 3 call logs, 1 lead note.");
}
