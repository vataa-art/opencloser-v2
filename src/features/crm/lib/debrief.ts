// ============================================================
// Local sales debrief — no LLM. Talk-ratio, objections, risks.
// Persist later as call_logs.debrief_json (see docs/SALES-DEBRIEF-SCHEMA.md).
// ============================================================

import { detectObjection, type ObjectionArchetype } from "../../voice/lib/objection-engine";

export type DebriefRisk = "no_dm" | "no_next_step" | "monologue" | "cooling" | "dnc";

export interface TranscriptLine {
  role: string;
  text: string;
}

export interface DebriefObjection {
  archetype: ObjectionArchetype;
  quote: string;
  addressed: boolean;
  product_gap: boolean;
}

export interface SalesDebrief {
  objections: DebriefObjection[];
  talk_ratio: number;
  next_step: { action: string; date: string; channel: string } | null;
  risks: DebriefRisk[];
  followup_draft: { text: string; status: "draft" };
  kb_claims_used: { source: string; updated_at: string }[];
}

const NEXT_STEP_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|tomorrow|next week|follow[- ]?up|\d{4}-\d{2}-\d{2})\b/i;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function talkRatio(transcript: TranscriptLine[]): number {
  let agent = 0;
  let user = 0;
  for (const line of transcript) {
    const n = wordCount(line.text ?? "");
    if (line.role === "model") agent += n;
    else if (line.role === "user") user += n;
  }
  const total = agent + user;
  return total === 0 ? 0 : agent / total;
}

export function buildSalesDebrief(transcript: TranscriptLine[]): SalesDebrief {
  const ratio = talkRatio(transcript);
  const objections: DebriefObjection[] = [];

  transcript.forEach((line, i) => {
    if (line.role !== "user") return;
    const match = detectObjection(line.text ?? "");
    if (!match) return;
    const nextModel = transcript.slice(i + 1).find(later => later.role === "model");
    const addressed = !!nextModel && wordCount(nextModel.text ?? "") >= 12;
    objections.push({
      archetype: match.archetype,
      quote: line.text,
      addressed,
      product_gap: match.archetype === "wrong_fit" || match.archetype === "technical",
    });
  });

  const blob = transcript.map((l) => l.text).join(" ");
  const next_step = NEXT_STEP_RE.test(blob)
    ? { action: "follow_up", date: "", channel: "unspecified" }
    : null;

  const risks: DebriefRisk[] = [];
  if (!next_step) risks.push("no_next_step");
  if (ratio > 0.75) risks.push("monologue");
  if (objections.some((o) => o.archetype === "authority" && !o.addressed)) {
    risks.push("no_dm");
  }

  return {
    objections,
    talk_ratio: ratio,
    next_step,
    risks,
    followup_draft: { text: "", status: "draft" },
    kb_claims_used: [],
  };
}
