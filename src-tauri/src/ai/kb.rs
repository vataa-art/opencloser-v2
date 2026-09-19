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

/// Recruitment knowledge directory (`knowledge/recruitment`) scanned at
/// startup for seed documents: `transcripts/*.txt` plus `courses.json`.
/// Resolution order: the `OPENCLOSER_KB_DIR` override, the repo checkout
/// next to `src-tauri/`, then the legacy pack-root layout. Packaged builds
/// simply log that no seed source exists (seeding is best-effort and never
/// fatal). Each source (transcripts, courses) is seeded independently, so a
/// checkout that ships only the JSON content pack still seeds the catalog.
fn seed_dir() -> Option<PathBuf> {
    if let Ok(dir) = env::var("OPENCLOSER_KB_DIR") {
        let p = PathBuf::from(dir);
        // Accept both the recruitment knowledge dir and (for older
        // setups) a direct transcripts path.
        let resolved = if p.join("transcripts").is_dir() {
            p
        } else {
            p.join("..")
        };
        return resolved.canonicalize().ok().filter(|c| c.is_dir());
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    [
        manifest.join("../knowledge/recruitment"),    // repo checkout
        manifest.join("../../knowledge/recruitment"), // legacy pack-root layout
    ]
    .iter()
    .find_map(|p| p.canonicalize().ok().filter(|c| c.is_dir()))
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

#[allow(clippy::too_many_arguments)]
fn insert_chunk(
    conn: &Connection,
    id: &str,
    domain: &str,
    source: &str,
    text: &str,
    embedding: &[f32],
    embedder: &str,
    tags_json: &str,
    // v8 hiring columns: set only for hiring-domain documents (e.g. a
    // published vacancy card); course seed rows keep them NULL.
    vacancy_id: Option<&str>,
    doc_type: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO kb_chunks (id, domain, source, text, embedding, dim, embedder, tags, vacancy_id, doc_type) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![id, domain, source, text, embedding_blob(embedding), embedding.len(), embedder, tags_json, vacancy_id, doc_type],
    )
    .map_err(|e| format!("Failed to insert kb chunk: {}", e))?;
    Ok(())
}

/// Ingest one document: clean, chunk, embed every chunk, and store them
/// under `(domain, source)`. Re-ingesting the same source replaces chunks.
/// The hiring columns (`vacancy_id`, `doc_type`) are optional and only set
/// by hiring-domain callers (e.g. `vacancy_publish_to_kb`); existing
/// frontend callers omit them and they arrive as `None`.
#[tauri::command]
pub async fn kb_ingest_document(
    app: AppHandle,
    domain: String,
    source: String,
    text: String,
    tags: Option<Vec<String>>,
    api_key: Option<String>,
    vacancy_id: Option<String>,
    doc_type: Option<String>,
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
        let (vec, embedder) = embed_for_ingest(chunk, &api_key).await?;
        embedded.push((format!("{}:{}:{}", domain, source, idx), vec, embedder));
    }
    let embedder = embedded
        .first()
        .map(|(_, _, e)| e.to_string())
        .unwrap_or_else(|| LOCAL_EMBEDDER_ID.to_string());

    let mut conn = open_db(&app)?;
    // Re-ingest is transactional: without the delete a shorter document
    // leaves stale chunks; without the transaction a failed insert loses
    // previously stored content (union-alpha review findings).
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin kb ingest transaction: {}", e))?;
    tx.execute(
        "DELETE FROM kb_chunks WHERE domain = ?1 AND source = ?2",
        rusqlite::params![domain, source],
    )
    .map_err(|e| format!("Failed to clear old kb chunks: {}", e))?;
    for ((id, vec, embedder), chunk) in embedded.iter().zip(&chunks) {
        insert_chunk(&tx, id, &domain, &source, chunk, vec, embedder, &tags_json, vacancy_id.as_deref(), doc_type.as_deref())?;
    }
    tx.commit()
        .map_err(|e| format!("Failed to commit kb ingest: {}", e))?;
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
) -> Result<Vec<Hit>, String> {    let sql = match domain {
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

/// Ingest-time embedding: Gemini when a key exists, deterministic local
/// embedder otherwise (fallback logged, never fatal).
async fn embed_for_ingest(text: &str, api_key: &Option<String>) -> Result<(Vec<f32>, &'static str), String> {
    if let Some(key) = valid_key(api_key) {
        match embed_with_gemini(&key, text).await {
            Ok(vec) => return Ok((vec, GEMINI_EMBEDDER_ID)),
            Err(e) => log::warn!("Gemini embedding failed, falling back to local: {}", e),
        }
    }
    Ok((embed_local(text), LOCAL_EMBEDDER_ID))
}

/// Query-time embedding for search: the local vector is always produced;
/// the Gemini vector is added when a key exists (failure tolerated so the
/// local index keeps working).
async fn embed_query_both(query: &str, api_key: &Option<String>) -> (Vec<f32>, Option<Vec<f32>>) {
    let local = embed_local(query);
    let mut gemini = None;
    if let Some(key) = valid_key(api_key) {
        match embed_with_gemini(&key, query).await {
            Ok(vec) => gemini = Some(vec),
            Err(e) => log::warn!("Gemini query embedding failed, local index only: {}", e),
        }
    }
    (local, gemini)
}

/// Search across BOTH embedder populations: the always-present local index
/// (what seeding produces) plus the Gemini index when a query embedding
/// exists. Merging guarantees seeded knowledge stays visible regardless of
/// key state (union-alpha review round 2: single-embedder filtering hid
/// seeded rows once a working key existed). Sync by design — the caller
/// awaits all embedding BEFORE touching the connection.
fn search_both(
    conn: &Connection,
    local_vec: &[f32],
    gemini_vec: Option<&[f32]>,
    domain: Option<&str>,
    k: usize,
) -> Result<(Vec<Hit>, String), String> {
    let mut hits = search_conn(conn, local_vec, LOCAL_EMBEDDER_ID, domain, k)?;
    let mut searched = LOCAL_EMBEDDER_ID.to_string();
    if let Some(gv) = gemini_vec {
        searched = GEMINI_EMBEDDER_ID.to_string();
        hits.append(&mut search_conn(conn, gv, GEMINI_EMBEDDER_ID, domain, k)?);
    }
    hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    hits.truncate(k);
    Ok((hits, searched))
}

/// KB grounding for model tool-calls: run a top-3 search and shape it as
/// the `functionResponse` payload for `search_knowledge_base`.
pub(crate) async fn tool_search(app: &AppHandle, query: &str, api_key: &Option<String>) -> serde_json::Value {
    let (local_vec, gemini_vec) = embed_query_both(query, api_key).await;
    let conn = match open_db(app) {
        Ok(conn) => conn,
        Err(e) => {
            log::warn!("KB tool search db unavailable: {}", e);
            return serde_json::json!({ "results": [], "error": "knowledge base unavailable" });
        }
    };
    let hits = match search_both(&conn, &local_vec, gemini_vec.as_deref(), None, 3) {
        Ok((hits, _)) => hits,
        Err(e) => {
            log::warn!("KB tool search failed: {}", e);
            return serde_json::json!({ "results": [], "error": "search failed" });
        }
    };
    serde_json::json!({
        "results": hits
            .iter()
            .map(|h| serde_json::json!({ "source": h.source, "text": h.text, "score": h.score }))
            .collect::<Vec<_>>()
    })
}

/// Vector search over `kb_chunks` across both embedder indexes
/// (see `search_merged`).
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
    let (local_vec, gemini_vec) = embed_query_both(&query, &api_key).await;
    let conn = open_db(&app)?;
    let (hits, embedder) = search_both(&conn, &local_vec, gemini_vec.as_deref(), domain.as_deref(), k)?;

    Ok(KbSearchResponse {
        results: hits
            .into_iter()
            .map(|h| KbSearchHit { source: h.source, text: h.text, score: h.score })
            .collect(),
        embedder,
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
        if insert_chunk(conn, &id, domain, source, chunk, &vec, LOCAL_EMBEDDER_ID, tags_json, None, None).is_ok() {
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
    let mut paths: Vec<PathBuf> = std::fs::read_dir(dir.join("transcripts"))
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
    let courses_path = dir.join("courses.json");
    if courses_path.is_file() {
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
