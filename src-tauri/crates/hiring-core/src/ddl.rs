//! Schema v8 DDL constants (P1-RECRUITMENT-HIRING.md §1). Pure strings —
//! the app crate owns `schema.rs` and consumes these in its v7→v8
//! migration; here they are unit-tested against an in-memory SQLite so the
//! migration can never ship SQL that does not parse or violates the spec.

/// Vacancies: one row per open role. `stack`, `must_have`, `nice_to_have`
/// are JSON arrays in TEXT columns.
pub const VACANCIES_DDL: &str = "CREATE TABLE IF NOT EXISTS vacancies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    seniority TEXT,
    stack TEXT NOT NULL DEFAULT '[]',
    salary_min INTEGER,
    salary_max INTEGER,
    currency TEXT,
    work_format TEXT NOT NULL,
    location TEXT,
    english_level TEXT,
    must_have TEXT NOT NULL DEFAULT '[]',
    nice_to_have TEXT NOT NULL DEFAULT '[]',
    hiring_manager TEXT,
    sla_days INTEGER,
    status TEXT NOT NULL DEFAULT 'intake'
);";

/// Candidates: one row per person. `contacts` is a JSON array in TEXT;
/// `dnc` / `consent_recording` are 0/1 INTEGER.
pub const CANDIDATES_DDL: &str = "CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    contacts TEXT NOT NULL DEFAULT '[]',
    source TEXT,
    current_role TEXT,
    years_exp REAL,
    stack TEXT NOT NULL DEFAULT '[]',
    salary_expectation TEXT,
    notice_period TEXT,
    work_format_pref TEXT,
    english_level TEXT,
    dnc INTEGER NOT NULL DEFAULT 0,
    consent_recording INTEGER NOT NULL DEFAULT 0,
    consent_data_at TEXT
);";

/// One row per (candidate, vacancy) pair — UNIQUE constraint enforces it.
pub const CANDIDATE_PIPELINE_DDL: &str = "CREATE TABLE IF NOT EXISTS candidate_pipeline (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES candidates(id),
    vacancy_id TEXT NOT NULL REFERENCES vacancies(id),
    stage TEXT NOT NULL DEFAULT 'sourced',
    entered_at TEXT NOT NULL,
    owner TEXT,
    reject_reason TEXT,
    UNIQUE(candidate_id, vacancy_id)
);";

/// One screening call session on a (candidate, vacancy) pair. Vector
/// columns are JSON arrays in TEXT.
pub const SCREENING_SESSIONS_DDL: &str = "CREATE TABLE IF NOT EXISTS screening_sessions (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    vacancy_id TEXT NOT NULL,
    steps_completed TEXT NOT NULL DEFAULT '[]',
    talk_ratio REAL,
    duration INTEGER,
    guardrail_hits TEXT NOT NULL DEFAULT '[]',
    transcript_ref TEXT
);";

/// Scorecard for a finished screening session; five criteria 0-3, max 15.
pub const SCORECARDS_DDL: &str = "CREATE TABLE IF NOT EXISTS scorecards (
    session_id TEXT PRIMARY KEY REFERENCES screening_sessions(id),
    fit_role INTEGER,
    motivation INTEGER,
    comp_match INTEGER,
    availability INTEGER,
    communication INTEGER,
    total INTEGER,
    grade TEXT,
    notes TEXT
);";

/// v8 kb_chunks step: nullable vacancy link for hiring documents.
/// SQLite allows only one ADD COLUMN per statement.
pub const KB_CHUNKS_ADD_VACANCY_ID_COL: &str =
    "ALTER TABLE kb_chunks ADD COLUMN vacancy_id TEXT;";

/// v8 kb_chunks step: document kind
/// (`vacancy_card | company_faq | comp_band | process`).
pub const KB_CHUNKS_ADD_DOC_TYPE_COL: &str = "ALTER TABLE kb_chunks ADD COLUMN doc_type TEXT;";

/// Ordered ALTER steps for the existing `kb_chunks` table (migration v8).
pub const KB_CHUNKS_V8_STEPS: &[&str] =
    &[KB_CHUNKS_ADD_VACANCY_ID_COL, KB_CHUNKS_ADD_DOC_TYPE_COL];

/// Hiring retrieval filter index: `domain="recruitment_hiring"` AND vacancy.
pub const KB_CHUNKS_V8_INDEX: &str =
    "CREATE INDEX IF NOT EXISTS idx_kb_chunks_domain_vacancy ON kb_chunks(domain, vacancy_id);";

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::ddl::{
        CANDIDATE_PIPELINE_DDL, CANDIDATES_DDL, KB_CHUNKS_V8_INDEX, KB_CHUNKS_V8_STEPS,
        SCREENING_SESSIONS_DDL, SCORECARDS_DDL, VACANCIES_DDL,
    };

    #[test]
    fn ddl_creates_schema_and_enforces_unique_pipeline() {
        // DoD-5: the v8 DDL executes and UNIQUE(candidate_id, vacancy_id) holds.
        let conn = Connection::open_in_memory().expect("open in-memory sqlite");

        for ddl in [
            VACANCIES_DDL,
            CANDIDATES_DDL,
            CANDIDATE_PIPELINE_DDL,
            SCREENING_SESSIONS_DDL,
            SCORECARDS_DDL,
        ] {
            conn.execute_batch(ddl).unwrap_or_else(|e| panic!("DDL failed: {e}\n{ddl}"));
        }

        // kb_chunks already exists in the real DB; stub it with the
        // pre-existing `domain` column so the ALTER steps apply.
        conn.execute_batch(
            "CREATE TABLE kb_chunks (
                id TEXT PRIMARY KEY,
                domain TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT ''
            );",
        )
        .expect("stub kb_chunks");
        for step in KB_CHUNKS_V8_STEPS {
            conn.execute_batch(step).unwrap_or_else(|e| panic!("kb_chunks step failed: {e}\n{step}"));
        }
        conn.execute_batch(KB_CHUNKS_V8_INDEX).expect("kb_chunks index");

        conn.execute(
            "INSERT INTO vacancies (id, title, company, work_format, must_have)
             VALUES ('v1', 'Rust Dev', 'Acme', 'remote', '[\"rust\"]')",
            [],
        )
        .expect("insert vacancy");
        conn.execute(
            "INSERT INTO candidates (id, full_name) VALUES ('c1', 'Ivan Petrenko')",
            [],
        )
        .expect("insert candidate");

        conn.execute(
            "INSERT INTO candidate_pipeline (id, candidate_id, vacancy_id, stage, entered_at)
             VALUES ('p1', 'c1', 'v1', 'sourced', '2026-09-17T10:00:00Z')",
            [],
        )
        .expect("first pipeline row");

        // Same (candidate_id, vacancy_id) again -> UNIQUE violation.
        let second = conn.execute(
            "INSERT INTO candidate_pipeline (id, candidate_id, vacancy_id, stage, entered_at)
             VALUES ('p2', 'c1', 'v1', 'contacted', '2026-09-17T11:00:00Z')",
            [],
        );
        assert!(
            second.is_err(),
            "duplicate (candidate_id, vacancy_id) must violate UNIQUE"
        );
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM candidate_pipeline", [], |r| r.get(0))
            .expect("count pipeline rows");
        assert_eq!(count, 1, "only the first pipeline row may exist");

        // New kb_chunks columns accept hiring-domain rows.
        conn.execute(
            "INSERT INTO kb_chunks (id, domain, content, vacancy_id, doc_type)
             VALUES ('k1', 'recruitment_hiring', 'vacancy card text', 'v1', 'vacancy_card')",
            [],
        )
        .expect("kb_chunks row with v8 columns");
        let index_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'index' AND name = 'idx_kb_chunks_domain_vacancy'",
                [],
                |r| r.get(0),
            )
            .expect("check index exists");
        assert_eq!(index_exists, 1, "idx_kb_chunks_domain_vacancy must exist");
    }

    #[test]
    fn scorecards_reference_screening_sessions() {
        let conn = Connection::open_in_memory().expect("open in-memory sqlite");
        conn.execute_batch(SCREENING_SESSIONS_DDL).expect("screening_sessions");
        conn.execute_batch(SCORECARDS_DDL).expect("scorecards");

        conn.execute(
            "INSERT INTO screening_sessions (id, candidate_id, vacancy_id)
             VALUES ('s1', 'c1', 'v1')",
            [],
        )
        .expect("insert session");
        conn.execute(
            "INSERT INTO scorecards (session_id, fit_role, motivation, comp_match, availability, communication, total, grade)
             VALUES ('s1', 3, 3, 2, 3, 2, 13, 'A')",
            [],
        )
        .expect("insert scorecard");

        // FK: scorecard for a missing session must fail.
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let orphan = conn.execute(
            "INSERT INTO scorecards (session_id, total, grade) VALUES ('missing', 10, 'B')",
            [],
        );
        assert!(orphan.is_err(), "scorecard FK to screening_sessions must be enforced");
    }
}
