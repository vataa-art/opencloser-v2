import { invoke } from "@tauri-apps/api/core";
import { getProviderKey } from "../stores/keys.store";

export interface KbSearchHit {
  source: string;
  text: string;
  score: number;
}

export interface KbSearchResponse {
  results: KbSearchHit[];
  embedder: string;
}

export interface KbIngestResult {
  chunks: number;
  embedder: string;
}

/**
 * Ingest a document into the knowledge base. The text is cleaned, chunked
 * and embedded (Gemini when a key exists, deterministic local embedder
 * otherwise) on the Rust side.
 */
export async function kbIngestDocument(req: {
  domain: string;
  source: string;
  text: string;
  tags?: string[];
}): Promise<KbIngestResult> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("kb_ingest_document", {
    domain: req.domain,
    source: req.source,
    text: req.text,
    tags: req.tags ?? undefined,
    apiKey: apiKey || undefined,
  });
}

/**
 * Semantic search over ingested knowledge-base chunks. Returns the top-k
 * chunks with their similarity score and originating source id.
 */
export async function kbSearch(req: {
  query: string;
  domain?: string;
  k?: number;
}): Promise<KbSearchResponse> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("kb_search", {
    query: req.query,
    domain: req.domain ?? undefined,
    k: req.k ?? undefined,
    apiKey: apiKey || undefined,
  });
}
