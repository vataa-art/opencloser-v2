// ============================================================
// Sim-session violation detection — feeds the readiness gate with
// what the rookie actually did during an ObjectionTrainer session.
// Fabricated-stat detection shares the CoachAgent semantics: a claim
// is a violation only when the knowledge base returned grounding
// chunks and none of them backs the figure.
// ============================================================

import { extractStatClaims, flagUnverifiedClaims } from "../voice/lib/coach-agent";
import { kbSearch } from "../../services/kb.service";
import { detectJobPromiseViolation } from "./readiness-gate";

export interface SimViolations {
  fabricatedStatViolation: boolean;
  jobPromiseViolation: boolean;
}

/** Detect readiness-gate violations from the rep's own sim messages. */
export async function detectSimViolations(userTexts: string[]): Promise<SimViolations> {
  const jobPromiseViolation = userTexts.some((t) => detectJobPromiseViolation(t));

  const claims = userTexts.flatMap((t) => extractStatClaims(t));
  if (claims.length === 0) {
    return { fabricatedStatViolation: false, jobPromiseViolation };
  }

  try {
    const res = await kbSearch({ query: userTexts.join(" "), k: 5 });
    const texts = res.results.map((r) => r.text);
    const fabricatedStatViolation =
      texts.length > 0 && flagUnverifiedClaims(claims, texts).length > 0;
    return { fabricatedStatViolation, jobPromiseViolation };
  } catch {
    // KB unavailable — cannot verify claims, so no violation is recorded.
    return { fabricatedStatViolation: false, jobPromiseViolation };
  }
}
