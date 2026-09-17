// ============================================================
// CoachAgent — KB-grounded coaching for live calls and sims.
// Replaces the static OBJECTION_MAP counter-scripts: the counter
// script is composed from knowledge-base chunks (with source
// attribution), and numeric claims made by the AI agent are
// verified against those chunks — invented statistics get flagged.
// ============================================================

import { kbSearch } from "../../../services/kb.service";
import type { ObjectionMatch } from "./objection-engine";

export interface StatClaim {
  raw: string;
  kind: "percent" | "multiple" | "ratio";
}

export interface FlaggedClaim extends StatClaim {
  reason: string;
}

export interface CoachAdvice {
  counterScript: string;
  sources: string[];
  flaggedClaims: FlaggedClaim[];
  hints: string[];
}

/** Numeric claim patterns the anti-hallucination gate cares about. */
export function extractStatClaims(text: string): StatClaim[] {
  const claims: StatClaim[] = [];
  const seen = new Set<string>();
  const tokenRe = /[a-z0-9.,%]+/gi;
  for (const token of text.match(tokenRe) ?? []) {
    const t = token.toLowerCase().replace(/,$/, "");
    let claim: StatClaim | null = null;
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(\d+(?:\.\d+)?)%$/))) {
      claim = { raw: `${m[1]}%`, kind: "percent" };
    } else if ((m = t.match(/^(\d+(?:\.\d+)?)-?x$/))) {
      claim = { raw: `${m[1]}x`, kind: "multiple" };
    } else if ((m = t.match(/^(\d+)\s+out\s+of\s+(\d+)$/))) {
      claim = { raw: `${m[1]} out of ${m[2]}`, kind: "ratio" };
    }
    if (claim && !seen.has(claim.raw)) {
      seen.add(claim.raw);
      claims.push(claim);
    }
  }
  // "10 out of 15" spans multiple tokens; catch it on the phrase level.
  const ratioRe = /(\d+)\s+out\s+of\s+(\d+)/gi;
  let r: RegExpExecArray | null;
  while ((r = ratioRe.exec(text)) !== null) {
    const raw = `${r[1]} out of ${r[2]}`;
    if (!seen.has(raw)) {
      seen.add(raw);
      claims.push({ raw, kind: "ratio" });
    }
  }
  return claims;
}

/**
 * A claim is "supported" when the same figure appears in one of the
 * retrieved knowledge-base chunks. Matching is boundary-checked so "3x"
 * does not verify against "13x" and "7%" against "27%" (union-alpha
 * review round 2).
 */
function claimSupported(claim: StatClaim, kbTexts: string[]): boolean {
  const escaped = claim.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\d.])${escaped}(?![\\d])`, "i");
  return kbTexts.some((t) => re.test(t));
}

export function flagUnverifiedClaims(
  claims: StatClaim[],
  kbTexts: string[]
): FlaggedClaim[] {
  return claims
    .filter((claim) => !claimSupported(claim, kbTexts))
    .map((claim) => ({
      ...claim,
      reason: `"${claim.raw}" is not backed by any knowledge-base source`,
    }));
}

function modelTexts(transcript: { role: string; text: string }[]): string[] {
  return transcript.filter((t) => t.role === "model").map((t) => t.text);
}

function trimChunk(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`;
}

/**
 * Compose a grounded counter-script for an objection from KB chunks.
 * Falls back to an empty script when the KB has nothing — the UI then
 * shows only the archetype alert without pretending to know the answer.
 */
export async function coachAdvise(input: {
  objection: ObjectionMatch | null;
  transcript: { role: string; text: string }[];
  domain?: string;
}): Promise<CoachAdvice> {
  const query = input.objection
    ? `${input.objection.trigger} ${input.objection.framework} ${input.objection.label}`
    : input.transcript.filter((t) => t.role === "user").slice(-1)[0]?.text ?? "";

  if (!query.trim()) {
    return { counterScript: "", sources: [], flaggedClaims: [], hints: [] };
  }

  let hits: { source: string; text: string }[] = [];
  try {
    const res = await kbSearch({ query, domain: input.domain ?? "sales", k: 3 });
    hits = res.results;
  } catch {
    // KB unavailable — advise without grounding rather than failing the call.
  }

  const flagged = flagUnverifiedClaims(
    extractStatClaims(modelTexts(input.transcript).join(" ")),
    hits.map((h) => h.text)
  );

  const top = hits[0];
  const counterScript = input.objection
    ? top
      ? `${input.objection.framework}: ${trimChunk(top.text)} [KB: ${top.source}]`
      : ""
    : "";

  return {
    counterScript,
    sources: hits.map((h) => h.source),
    flaggedClaims: flagged,
    hints: hits.slice(0, 2).map((h) => `📚 ${trimChunk(h.text, 140)} [KB: ${h.source}]`),
  };
}

/**
 * Trailing debounce for coach calls so transcript updates don't spam the
 * KB / embedding API. Only the last call inside the window fires.
 */
export function createDebouncedCoach<A extends unknown[]>(
  delayMs: number,
  fn: (...args: A) => Promise<void>
): { schedule: (...args: A) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(...args: A) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void fn(...args);
      }, delayMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
