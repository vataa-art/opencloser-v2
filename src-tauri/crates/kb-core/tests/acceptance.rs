//! Acceptance: `kb_search("what is an API")` must rank the API-design
//! video transcript (vHG4m5ptmJs) inside the top-3 hits for the
//! recruitment transcript corpus.
//!
//! Runs against the real transcripts in `knowledge/recruitment/transcripts/`
//! (resolved relative to this crate: the repo checkout first, then the
//! legacy pack-root layout). When the corpus is absent — it is a local
//! content pack, not committed to the repository — the test skips rather
//! than failing, mirroring the configs-parity vitest convention.

use std::path::PathBuf;

use kb_core::{chunk_text, embed_local, rank, strip_vtt, Candidate, DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP};

fn transcripts_dir() -> Option<PathBuf> {
    // Repo checkout: crates/kb-core → src-tauri → project → knowledge/
    // Legacy pack root: one directory above the project checkout.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../knowledge/recruitment/transcripts")
        .canonicalize()
        .ok()
        .filter(|p| p.is_dir())
        .or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../../knowledge/recruitment/transcripts")
                .canonicalize()
                .ok()
                .filter(|p| p.is_dir())
        })
}

#[test]
fn what_is_an_api_ranks_vhg4m5ptmjs_in_top3() {
    let Some(dir) = transcripts_dir() else {
        eprintln!("SKIP: recruitment transcript corpus not present");
        return;
    };

    let mut corpus: Vec<(String, Vec<f32>)> = Vec::new();
    for entry in std::fs::read_dir(&dir).expect("read transcripts dir") {
        let path = entry.expect("dir entry").path();
        if path.extension().and_then(|e| e.to_str()) != Some("txt") {
            continue;
        }
        let source = path
            .file_stem()
            .and_then(|s| s.to_str())
            .expect("utf8 file stem")
            .trim_end_matches(".en")
            .to_string();
        let raw = std::fs::read_to_string(&path).expect("read transcript");
        for chunk in chunk_text(&strip_vtt(&raw), DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP) {
            corpus.push((source.clone(), embed_local(&chunk)));
        }
    }
    assert!(!corpus.is_empty(), "no transcript chunks ingested");

    let candidates: Vec<Candidate<'_>> = corpus
        .iter()
        .map(|(source, emb)| Candidate { source, text: "", embedding: emb })
        .collect();
    let query = embed_local("what is an API");
    let hits = rank(&query, &candidates, 3);

    assert!(
        hits.iter().any(|h| h.source == "vHG4m5ptmJs"),
        "expected vHG4m5ptmJs in top-3, got: {:?}",
        hits.iter().map(|h| (h.source.as_str(), h.score)).collect::<Vec<_>>()
    );
}
