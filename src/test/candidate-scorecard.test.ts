import { describe, it, expect } from "vitest";
import {
  scoreCandidate,
  scorecardSummary,
  SCORECARD_MAX,
  type CriterionScores,
} from "../features/copilot/candidate-scorecard";

const scores = (m: 0 | 1 | 2 | 3, t: 0 | 1 | 2 | 3, b: 0 | 1 | 2 | 3, r: 0 | 1 | 2 | 3, d: 0 | 1 | 2 | 3): CriterionScores => ({
  motivation: m,
  time: t,
  budget: b,
  readiness: r,
  decision: d,
});

describe("candidate scorecard bands", () => {
  it("A 12–15 — pass today", () => {
    const r = scoreCandidate(scores(3, 3, 2, 2, 2));
    expect(r.total).toBe(12);
    expect(r.band).toBe("A");
    expect(r.action).toContain("Передавати далі сьогодні");
  });

  it("B 8–11 — nurture", () => {
    const r = scoreCandidate(scores(2, 1, 2, 2, 1));
    expect(r.total).toBe(8);
    expect(r.band).toBe("B");
    expect(r.action).toContain("Nurture");
  });

  it("C 4–7 — webinar list", () => {
    const r = scoreCandidate(scores(1, 1, 0, 1, 1));
    expect(r.total).toBe(4);
    expect(r.band).toBe("C");
    expect(r.action).toContain("вебінар");
  });

  it("D 0–3 — polite decline", () => {
    const r = scoreCandidate(scores(0, 1, 0, 1, 0));
    expect(r.total).toBe(2);
    expect(r.band).toBe("D");
    expect(r.action).toContain("відмова");
  });

  it("caps at 15 and reports the max", () => {
    const r = scoreCandidate(scores(3, 3, 3, 3, 3));
    expect(r.total).toBe(15);
    expect(r.max).toBe(SCORECARD_MAX);
    expect(SCORECARD_MAX).toBe(15);
  });
});

describe("scorecardSummary", () => {
  it("renders a one-line debrief", () => {
    const s = scorecardSummary(scores(3, 2, 3, 2, 3));
    expect(s).toMatch(/Scorecard: A \(13\/15\)/);
    expect(s).toContain("Мотивація 3/3");
    expect(s).toContain("Час 2/3");
  });
});
