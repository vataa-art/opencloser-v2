// ============================================================
// Candidate scorecard: 0–3 points per criterion, A/B/C/D bands.
// Pure logic over the candidate-scorecard config.
// ============================================================

import { SCORECARD_BANDS, SCORECARD_CRITERIA, type ScoreValue } from "../../configs/candidate-scorecard";

export interface CriterionScores {
  motivation: ScoreValue;
  time: ScoreValue;
  budget: ScoreValue;
  readiness: ScoreValue;
  decision: ScoreValue;
}

export interface ScorecardResult {
  total: number;
  max: number;
  band: "A" | "B" | "C" | "D";
  action: string;
}

export const SCORECARD_MAX = SCORECARD_CRITERIA.length * 3;

/** Total + band + recommended action; unknown totals land in band D. */
export function scoreCandidate(scores: CriterionScores): ScorecardResult {
  const total = SCORECARD_CRITERIA.reduce(
    (sum, c) => sum + (scores[c.id as keyof CriterionScores] ?? 0),
    0
  );
  const band =
    SCORECARD_BANDS.find((b) => total >= b.min && total <= b.max) ??
    SCORECARD_BANDS[SCORECARD_BANDS.length - 1];
  return { total, max: SCORECARD_MAX, band: band.band, action: band.action };
}

/** One-line summary for the lead note / debrief. */
export function scorecardSummary(scores: CriterionScores): string {
  const r = scoreCandidate(scores);
  const details = SCORECARD_CRITERIA.map(
    (c) => `${c.title} ${scores[c.id as keyof CriterionScores]}/3`
  ).join(", ");
  return `Scorecard: ${r.band} (${r.total}/${r.max}) — ${r.action}. ${details}.`;
}
