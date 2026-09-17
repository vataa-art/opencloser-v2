import { invoke } from "@tauri-apps/api/core";

// ── Types (contract shared with the Rust hiring commands) ──

export interface VacancyInput {
  title: string;
  company: string;
  seniority?: string;
  stack?: string[];
  salary_min: number;
  salary_max: number;
  currency: string;
  work_format: string;
  location?: string;
  english_level?: string;
  must_have: string[];
  nice_to_have?: string[];
  hiring_manager: string;
  sla_days: number;
}

export type Vacancy = VacancyInput & { id: string; status: string };

export interface HiringError {
  code: string;
  missing: string[];
  message: string;
}

export interface PublishResult {
  chunks: number;
  embedder: string;
}

export interface UpsertResult {
  id: string;
  deduped: boolean;
}

export interface MoveResult {
  candidate_id: string;
  vacancy_id: string;
  stage: string;
}

export interface CandidateContact {
  kind: string;
  value: string;
}

/** Mirrors the spec `candidates` columns (minus the DB-generated id). */
export interface CandidateInput {
  full_name: string;
  contacts: CandidateContact[];
  source: string;
  current_role?: string;
  years_exp?: number;
  stack?: string[];
  salary_expectation?: string;
  notice_period?: string;
  work_format_pref?: string;
  english_level?: string;
  dnc: boolean;
  consent_recording: boolean;
}

/**
 * Tauri invoke rejections surface the raw error object, so a Rust
 * HiringError arrives here as a plain JS object. Use this guard before
 * treating a rejection as structured validation feedback.
 */
export function isHiringError(e: unknown): e is HiringError {
  if (typeof e !== "object" || e === null) return false;
  const candidate = e as Partial<HiringError>;
  return (
    typeof candidate.code === "string" &&
    Array.isArray(candidate.missing) &&
    candidate.missing.every((m) => typeof m === "string") &&
    typeof candidate.message === "string"
  );
}

// ── Command wrappers ──

/** Create a vacancy after Rust-side required-field validation. */
export async function vacancyCreate(payload: VacancyInput): Promise<Vacancy> {
  return invoke("vacancy_create", { payload });
}

/** Render the vacancy card and ingest it into the recruitment_hiring KB domain. */
export async function vacancyPublishToKb(vacancyId: string): Promise<PublishResult> {
  return invoke("vacancy_publish_to_kb", { vacancyId });
}

/** Upsert a candidate, deduped by contact on the Rust side. */
export async function candidateUpsert(payload: CandidateInput): Promise<UpsertResult> {
  return invoke("candidate_upsert", { payload });
}

/** Move a candidate within a vacancy pipeline; rejects with HiringError listing unmet exit criteria. */
export async function pipelineMove(
  candidateId: string,
  vacancyId: string,
  toStage: string
): Promise<MoveResult> {
  return invoke("pipeline_move", { candidateId, vacancyId, toStage });
}
