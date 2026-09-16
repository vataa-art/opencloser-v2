//! Pure knowledge-base primitives: transcript cleaning, chunking, a
//! deterministic offline embedder, and cosine ranking.
//!
//! This crate is intentionally free of Tauri / IO / HTTP dependencies so
//! every function stays unit-testable and the vector math can be exercised
//! without linking the full app library.

pub mod gemini_tools;

/// Dimension of the offline hashed bag-of-words embedder.
pub const LOCAL_EMBED_DIM: usize = 256;

/// Identifier stored alongside chunks embedded with [`embed_local`].
pub const LOCAL_EMBEDDER_ID: &str = "local-hash-256";

/// Identifier for chunks embedded with the Gemini text-embedding-004 API.
pub const GEMINI_EMBEDDER_ID: &str = "gemini-text-embedding-004";

/// Default maximum characters per chunk used by the app ingest path.
pub const DEFAULT_CHUNK_CHARS: usize = 900;

/// Default character overlap between consecutive chunks.
pub const DEFAULT_CHUNK_OVERLAP: usize = 150;

/// Remove YouTube/VTT inline timestamp tags like `<00:00:02.129>` and
/// collapse the resulting whitespace runs.
pub fn strip_vtt(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.char_indices().peekable();
    while let Some((i, ch)) = chars.next() {
        if ch == '<' {
            // Skip until the closing '>' (or end of input).
            let close = text[i..].find('>');
            match close {
                Some(end) => {
                    for _ in 0..end {
                        chars.next();
                    }
                }
                None => break,
            }
            continue;
        }
        out.push(ch);
    }
    collapse_whitespace(&out)
}

fn collapse_whitespace(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_space = false;
    for ch in text.chars() {
        if ch.is_whitespace() {
            in_space = !out.is_empty();
            if in_space {
                out.push(' ');
            }
        } else {
            in_space = false;
            out.push(ch);
        }
    }
    if in_space {
        out.pop();
    }
    out
}

/// Split cleaned text into overlapping word-aligned chunks.
///
/// Chunks never exceed `max_chars` and each chunk after the first re-uses
/// roughly `overlap_chars` worth of trailing words so answers that straddle
/// a boundary stay retrievable.
pub fn chunk_text(text: &str, max_chars: usize, overlap_chars: usize) -> Vec<String> {
    let clean = collapse_whitespace(text);
    let words: Vec<&str> = clean.split(' ').filter(|w| !w.is_empty()).collect();
    let mut chunks = Vec::new();
    let mut current: Vec<&str> = Vec::new();
    let mut current_len = 0usize;

    let mut push_chunk = |current: &mut Vec<&str>| {
        if !current.is_empty() {
            chunks.push(current.join(" "));
        }
    };

    for word in words {
        let word_len = word.len();
        if current_len + word_len + 1 > max_chars && !current.is_empty() {
            push_chunk(&mut current);
            // Build the overlap tail from the words we just flushed.
            let mut tail_len = 0usize;
            let mut tail: Vec<&str> = Vec::new();
            for w in current.iter().rev() {
                if tail_len + w.len() + 1 > overlap_chars {
                    break;
                }
                tail_len += w.len() + 1;
                tail.push(w);
            }
            tail.reverse();
            current = tail;
            current_len = current.iter().map(|w| w.len() + 1).sum::<usize>().saturating_sub(1);
        }
        current.push(word);
        current_len += word_len + if current_len > 0 { 1 } else { 0 };
    }
    push_chunk(&mut current);
    chunks
}

/// Serialize an embedding vector to a little-endian f32 BLOB for SQLite.
pub fn embedding_blob(vec: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vec.len() * 4);
    for v in vec {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

/// Deserialize an embedding BLOB previously written by [`embedding_blob`].
pub fn embedding_vec(blob: &[u8], dim: usize) -> Vec<f32> {
    blob.chunks_exact(4)
        .take(dim)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn fnv1a(bytes: &[u8]) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for b in bytes {
        hash ^= u32::from(*b);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash
}

/// Deterministic offline embedding: hashed bag-of-words with L2
/// normalization. Not semantic — but stable, dependency-free, and good
/// enough for keyword-level retrieval when no embedding API key exists.
pub fn embed_local(text: &str) -> Vec<f32> {
    let mut vec = vec![0f32; LOCAL_EMBED_DIM];
    let text = text.to_lowercase();
    let mut token = String::new();
    for ch in text.chars().chain(std::iter::once(' ')) {
        if ch.is_ascii_alphanumeric() || ch == '\'' {
            token.push(ch);
        } else if !token.is_empty() {
            let idx = (fnv1a(token.as_bytes()) as usize) % LOCAL_EMBED_DIM;
            vec[idx] += 1.0;
            token.clear();
        }
    }
    let norm = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in &mut vec {
            *v /= norm;
        }
    }
    vec
}

/// Cosine similarity of two equal-length vectors; 0 when either is empty.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm_a = a.iter().map(|v| v * v).sum::<f32>().sqrt();
    let norm_b = b.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot / (norm_a * norm_b)
    }
}

/// A chunk candidate handed to [`rank`].
pub struct Candidate<'a> {
    pub source: &'a str,
    pub text: &'a str,
    pub embedding: &'a [f32],
}

/// A ranked search hit.
pub struct Hit {
    pub source: String,
    pub text: String,
    pub score: f32,
}

/// Rank candidates by cosine similarity against `query`, best first, top `k`.
pub fn rank(query: &[f32], candidates: &[Candidate<'_>], k: usize) -> Vec<Hit> {
    let mut hits: Vec<Hit> = candidates
        .iter()
        .map(|c| Hit {
            source: c.source.to_string(),
            text: c.text.to_string(),
            score: cosine_similarity(query, c.embedding),
        })
        .collect();
    hits.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    hits.truncate(k);
    hits
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_vtt_removes_timestamps() {
        let raw = "I'm<00:00:02.129> just reading<00:00:07.859> a term<00:00:09.000> API";
        assert_eq!(strip_vtt(raw), "I'm just reading a term API");
    }

    #[test]
    fn strip_vtt_handles_unclosed_tag() {
        assert_eq!(strip_vtt("hello <00:00"), "hello");
    }

    #[test]
    fn chunk_text_respects_max_chars_and_overlaps() {
        let text = "word ".repeat(400); // 2000 chars
        let chunks = chunk_text(&text, 200, 40);
        assert!(chunks.len() > 3);
        for c in &chunks {
            assert!(c.len() <= 200);
        }
        // Consecutive chunks share overlap words.
        let first_words: Vec<&str> = chunks[1].split(' ').collect();
        let prev_words: Vec<&str> = chunks[0].split(' ').collect();
        assert_eq!(first_words[0], prev_words[prev_words.len() - 1]);
    }

    #[test]
    fn chunk_text_single_short_input() {
        assert_eq!(chunk_text("hello world", 200, 20), vec!["hello world"]);
    }

    #[test]
    fn embed_local_is_deterministic_and_normalized() {
        let a = embed_local("What is an API design");
        let b = embed_local("what is an API design");
        assert_eq!(a, b);
        let norm: f32 = a.iter().map(|v| v * v).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-5);
        assert_eq!(a.len(), LOCAL_EMBED_DIM);
    }

    #[test]
    fn embed_local_differentiates_topics() {
        let api = embed_local("api design endpoint request response");
        let sales = embed_local("sales pipeline objection budget prospect");
        assert!(cosine_similarity(&api, &sales) < 0.2);
    }

    #[test]
    fn rank_orders_by_similarity() {
        let api = embed_local("what is an API");
        let hit_api = embed_local("an API is a way programs talk to each other");
        let hit_other = embed_local("recruiters screen candidates for roles");
        let cands = vec![
            Candidate { source: "other", text: "recruiters", embedding: &hit_other },
            Candidate { source: "api", text: "api talk", embedding: &hit_api },
        ];
        let hits = rank(&api, &cands, 2);
        assert_eq!(hits[0].source, "api");
        assert!(hits[0].score > hits[1].score);
    }

    #[test]
    fn cosine_handles_len_mismatch_and_zero() {
        assert_eq!(cosine_similarity(&[1.0], &[1.0, 2.0]), 0.0);
        assert_eq!(cosine_similarity(&[0.0; 4], &[1.0, 2.0, 3.0, 4.0]), 0.0);
    }

    #[test]
    fn embedding_blob_roundtrip() {
        let vec = vec![0.25f32, -1.0, 3.5];
        let blob = embedding_blob(&vec);
        assert_eq!(embedding_vec(&blob, 3), vec);
    }
}
