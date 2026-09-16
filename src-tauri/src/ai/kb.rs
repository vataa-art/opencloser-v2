use std::path::PathBuf;

use kb_core::{
    chunk_text, embed_local, embedding_blob, embedding_vec, rank, strip_vtt, Candidate, Hit,
    GEMINI_EMBEDDER_ID, LOCAL_EMBEDDER_ID,
};
use reqwest::Client;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value};
use std::env;
use tauri::{AppHandle, Manager};

/// Directory scanned at startup for seed documents. Dev builds resolve the
/// repo-relative `knowledge/` folder; packaged builds simply log that no
/// seed source exists (seeding is best-effort and never fatal).
fn seed_dir() -> Option<PathBuf> {
    if let Ok(dir) = env::var("OPENCLOSER_KB_DIR") {
        let p = PathBuf::from(dir);
        return p.is_dir().then_some(p);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_knowledge = manifest
        .join("../../knowledge/recruitment/transcripts")
        .canonicalize()
        .ok();
    repo_knowledge.filter(|p| p.is_dir())
}

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

fn valid_key(api_key: &Option<String>) -> Option<String> {
    api_key
        .as_deref()
        .filter(|k| !k.is_empty() && *k != "MY_GEMINI_API_KEY")
        .map(|k| k.to_string())
        .or_else(|| env::var("GEMINI_API_KEY").ok())
        .filter(|k| !k.is_empty() && k != "MY_GEMINI_API_KEY")
}

async fn embed_with_gemini(api_key: &str, text: &str) -> Result<Vec<f32>, String> {
    let client = Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={}",
        api_key
    );
    let payload = json!({
        "model": "models/text-embedding-004",
        "content": { "parts": [{ "text": text }] }
    });
    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Embedding request failed: {}", e))?;
    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini embedding API error: {}", err_text));
    }
    let body: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse embedding response: {}", e))?;
    let values: Vec<f32> = body["embedding"]["values"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect())
        .ok_or_else(|| "Embedding values missing from response".to_string())?;
    if values.is_empty() {
        return Err("Empty embedding returned by Gemini".to_string());
    }
    Ok(values)
}

/// Embed `text` with Gemini when a key is available, otherwise fall back to
/// the deterministic offline embedder. Returns the vector plus the embedder
/// id that must be stored with (and searched against) the chunk.
async fn embed_text(text: &str, api_key: &Option<String>) -> Result<(Vec<f32>, &'static str), String> {
    if let Some(key) = valid_key(api_key) {
        match embed_with_gemini(&key, text).await {
            Ok(vec) => return Ok((vec, GEMINI_EMBEDDER_ID)),
            Err(e) => log::warn!("Gemini embedding failed, falling back to local: {}", e),
        }
    }
    Ok((embed_local(text), LOCAL_EMBEDDER_ID))
}

#[derive(Serialize)]
pub struct KbIngestResult {
    pub chunks: usize,
    pub embedder: String,
}

#[derive(Serialize)]
pub struct KbSearchHit {
    pub source: String,
    pub text: String,
    pub score: f32,
}

#[derive(Serialize)]
pub struct KbSearchResponse {
    pub results: Vec<KbSearchHit>,
    pub embedder: String,
}

fn insert_chunk(
    conn: &Connection,
    id: &str,
    domain: &str,
    source: &str,
    text: &str,
    embedding: &[f32],
    embedder: &str,
    tags_json: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO kb_chunks (id, domain, source, text, embedding, dim, embedder, tags) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, domain, source, text, embedding_blob(embedding), embedding.len(), embedder, tags_json],
    )
    .map_err(|e| format!("Failed to insert kb chunk: {}", e))?;
    Ok(())
}

/// Ingest one document: clean, chunk, embed every chunk, and store them
/// under `(domain, source)`. Re-ingesting the same source replaces chunks.
#[tauri::command]
pub async fn kb_ingest_document(
    app: AppHandle,
    domain: String,
    source: String,
    text: String,
    tags: Option<Vec<String>>,
    api_key: Option<String>,
) -> Result<KbIngestResult, String> {
    if domain.trim().is_empty() || source.trim().is_empty() {
        return Err("domain and source are required".into());
    }
    let chunks = chunk_text(&strip_vtt(&text), kb_core::DEFAULT_CHUNK_CHARS, kb_core::DEFAULT_CHUNK_OVERLAP);
    if chunks.is_empty() {
        return Err("Document produced no chunks (empty text?)".into());
    }
    let tags_json = serde_json::to_string(&tags.unwrap_or_default()).unwrap_or_else(|_| "[]".into());

    let mut embedded: Vec<(String, Vec<f32>, &'static str)> = Vec::with_capacity(chunks.len());
    for (idx, chunk) in chunks.iter().enumerate() {
        let (vec, embedder) = embed_text(chunk, &api_key).await?;
        embedded.push((format!("{}:{}:{}", domain, source, idx), vec, embedder));
    }
    let embedder = embedded
        .first()
        .map(|(_, _, e)| e.to_string())
        .unwrap_or_else(|| LOCAL_EMBEDDER_ID.to_string());

    let conn = open_db(&app)?;
    // Re-ingest must be atomic per source: without this delete, a shorter
    // document leaves stale higher-index chunks searchable (union-alpha
    // iter-1 review finding).
    conn.execute(
        "DELETE FROM kb_chunks WHERE domain = ?1 AND source = ?2",
        rusqlite::params![domain, source],
    )
    .map_err(|e| format!("Failed to clear old kb chunks: {}", e))?;
    for ((id, vec, embedder), chunk) in embedded.iter().zip(&chunks) {
        insert_chunk(&conn, id, &domain, &source, chunk, vec, embedder, &tags_json)?;
    }
    Ok(KbIngestResult { chunks: embedded.len(), embedder })
}

/// Shared vector search over `kb_chunks` on an open connection: cosine-ranks
/// rows stored with `embedder` against a precomputed query vector.
fn search_conn(
    conn: &Connection,
    query_vec: &[f32],
    embedder: &str,
    domain: Option<&str>,
    k: usize,
) -> Result<Vec<Hit>, String> {
    let sql = match domain {
        Some(_) => "SELECT source, text, embedding, dim FROM kb_chunks WHERE embedder = ?1 AND domain = ?2",
        None => "SELECT source, text, embedding, dim FROM kb_chunks WHERE embedder = ?1",
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let map_row = |row: &rusqlite::Row| -> Result<(String, String, Vec<u8>, usize), rusqlite::Error> {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Vec<u8>>(2)?,
            row.get::<_, usize>(3)?,
        ))
    };
    let rows: Vec<(String, String, Vec<u8>, usize)> = match domain {
        Some(d) => stmt
            .query_map(rusqlite::params![embedder, d], map_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?,
        None => stmt
            .query_map(rusqlite::params![embedder], map_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<_, _>>()
            .map_err(|e| e.to_string())?,
    };

    struct StoredChunk {
        source: String,
        text: String,
        embedding: Vec<f32>,
    }
    let stored: Vec<StoredChunk> = rows
        .into_iter()
        .map(|(source, text, blob, dim)| StoredChunk {
            source,
            text,
            embedding: embedding_vec(&blob, dim),
        })
        .collect();
    let candidates: Vec<Candidate<'_>> = stored
        .iter()
        .map(|c| Candidate { source: &c.source, text: &c.text, embedding: &c.embedding })
        .collect();
    Ok(rank(&query_vec, &candidates, k))
}

/// KB grounding for model tool-calls: run a top-3 search and shape it as
/// the `functionResponse` payload for `search_knowledge_base`.
pub(crate) async fn tool_search(app: &AppHandle, query: &str, api_key: &Option<String>) -> serde_json::Value {
    let (query_vec, embedder) = match embed_text(query, api_key).await {
        Ok(pair) => pair,
        Err(e) => {
            log::warn!("KB tool search embed failed: {}", e);
            return serde_json::json!({ "results": [], "error": "embedding unavailable" });
        }
    };
    let conn = match open_db(app) {
        Ok(conn) => conn,
        Err(e) => {
            log::warn!("KB tool search db unavailable: {}", e);
            return serde_json::json!({ "results": [], "error": "knowledge base unavailable" });
        }
    };
    let hits = search_conn(&conn, &query_vec, embedder, None, 3).unwrap_or_default();
    serde_json::json!({
        "results": hits
            .iter()
            .map(|h| serde_json::json!({ "source": h.source, "text": h.text, "score": h.score }))
            .collect::<Vec<_>>()
    })
}

/// Vector search over `kb_chunks`. The query is embedded with the active
/// embedder and compared against chunks stored by the same embedder, so a
/// key-less offline index never mixes with Gemini-embedded rows.
#[tauri::command]
pub async fn kb_search(
    app: AppHandle,
    query: String,
    domain: Option<String>,
    k: Option<i64>,
    api_key: Option<String>,
) -> Result<KbSearchResponse, String> {
    if query.trim().is_empty() {
        return Err("query is required".into());
    }
    let k = k.unwrap_or(5).clamp(1, 50) as usize;
    let (query_vec, embedder) = embed_text(&query, &api_key).await?;

    let conn = open_db(&app)?;
    let hits = search_conn(&conn, &query_vec, embedder, domain.as_deref(), k)?;

    Ok(KbSearchResponse {
        results: hits
            .into_iter()
            .map(|h| KbSearchHit { source: h.source, text: h.text, score: h.score })
            .collect(),
        embedder: embedder.to_string(),
    })
}

/// Ingest one document unless its `(domain, source)` chunks already exist.
/// Idempotent: re-seeding skips known sources, so new documents (e.g. a
/// newly added course) are picked up on the next launch.
fn seed_document(
    conn: &Connection,
    domain: &str,
    source: &str,
    text: &str,
    tags_json: &str,
) -> usize {
    let existing: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM kb_chunks WHERE domain = ?1 AND source = ?2",
            rusqlite::params![domain, source],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if existing > 0 {
        return 0;
    }
    let chunks = chunk_text(&strip_vtt(text), kb_core::DEFAULT_CHUNK_CHARS, kb_core::DEFAULT_CHUNK_OVERLAP);
    let mut inserted = 0usize;
    for (idx, chunk) in chunks.iter().enumerate() {
        let vec = embed_local(chunk);
        let id = format!("{}:{}:{}", domain, source, idx);
        if insert_chunk(conn, &id, domain, source, chunk, &vec, LOCAL_EMBEDDER_ID, tags_json).is_ok() {
            inserted += 1;
        }
    }
    inserted
}

/// Flatten one courses.json entry into an ingestible text block.
fn course_block(course: &Value) -> Option<(String, String)> {
    let id = course["id"].as_str()?.to_string();
    let title = course["title"].as_str().unwrap_or("Untitled course");
    let publisher = course["publisher"].as_str().unwrap_or("unknown");
    let topics = course["topics"]
        .as_array()
        .map(|t| t.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    let coverage = course["coverage"]
        .as_array()
        .map(|t| t.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    let url = course["url"].as_str().unwrap_or("");
    let lessons = course["lessons"]
        .as_i64()
        .map(|n| format!("{} lessons", n))
        .unwrap_or_default();
    let block = format!(
        "Recruitment training course: {}. Publisher: {}. Topics: {}. Coverage: {}. {} URL: {}",
        title, publisher, topics, coverage, lessons, url
    );
    Some((id, block))
}

/// Startup seeding: ingest `knowledge/recruitment/` into the KB —
/// transcripts as one source per video plus flattened course catalog
/// entries. Best-effort: failures are logged, never fatal.
pub fn seed_if_empty(conn: &Connection) -> usize {
    let Some(dir) = seed_dir() else {
        log::info!("No KB seed directory found; starting with an empty knowledge base.");
        return 0;
    };

    let mut ingested = 0usize;

    // 1. Transcripts: knowledge/recruitment/transcripts/*.txt
    let mut paths: Vec<PathBuf> = std::fs::read_dir(&dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("txt"))
                .collect()
        })
        .unwrap_or_default();
    paths.sort();
    for path in paths {
        let source = match path.file_stem().and_then(|s| s.to_str()) {
            Some(stem) => stem.trim_end_matches(".en").to_string(),
            None => continue,
        };
        let raw = match std::fs::read_to_string(&path) {
            Ok(text) => text,
            Err(e) => {
                log::warn!("KB seed: cannot read {}: {}", path.display(), e);
                continue;
            }
        };
        ingested += seed_document(conn, "recruitment", &source, &raw, "[]");
    }

    // 2. Course catalog: knowledge/recruitment/courses.json
    if let Some(courses_path) = dir
        .parent()
        .map(|p| p.join("courses.json"))
        .filter(|p| p.is_file())
    {
        match std::fs::read_to_string(&courses_path).map_err(|e| e.to_string()).and_then(|s| serde_json::from_str::<Value>(&s).map_err(|e| e.to_string())) {
            Ok(catalog) => {
                for course in catalog["courses"].as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
                    if let Some((id, text)) = course_block(course) {
                        ingested += seed_document(conn, "recruitment", &id, &text, &serde_json::json!(["course"]).to_string());
                    }
                }
            }
            Err(e) => log::warn!("KB seed: cannot parse courses.json: {}", e),
        }
    }

    log::info!("Knowledge base seed pass complete: {} new chunks ({}).", ingested, dir.display());
    ingested
}
