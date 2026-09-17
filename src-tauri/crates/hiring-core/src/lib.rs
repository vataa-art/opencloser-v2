//! Pure hiring-vertical logic for the P1 Recruitment Hiring domain:
//! vacancy validation, pipeline stage exit criteria, candidate contact
//! dedupe, deterministic vacancy-card rendering, and the schema-v8 DDL
//! constants.
//!
//! This crate is intentionally free of Tauri / IO / HTTP dependencies so
//! every function stays unit-testable without linking the full app library
//! (windows-gnu cdylib ordinal limit). `rusqlite` is a dev-dependency only,
//! used to prove the DDL constants actually execute against SQLite.

pub mod card;
pub mod ddl;
pub mod dedupe;
pub mod error;
pub mod pipeline;
pub mod types;
pub mod validate;
