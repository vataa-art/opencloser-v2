import { describe, it, expect } from "vitest";
import {
  managerAutoFlag,
  top3ToImprove,
  weeklyProgress,
  type CallMetricEvent,
  type SimMetricEvent,
  type WeeklyProgress,
} from "../features/copilot/progress-metrics";

// Monday, UTC midnight — pairs with plain "YYYY-MM-DD" event dates.
const WEEK_START = new Date("2026-09-14");

const makeCall = (overrides: Partial<CallMetricEvent> = {}): CallMetricEvent => ({
  callId: "c1",
  date: "2026-09-14",
  stage4Filled: true,
  nextStepConcrete: true,
  kbLookups: 2,
  failedArchetypes: [],
  talkRatio: 0.5,
  promiseViolation: false,
  ...overrides,
});

const emptyProgress: WeeklyProgress = {
  simCount: 0,
  avgSimScore: null,
  talkRatio: null,
  stage4Rate: null,
  nextStepRate: null,
  kbLookupsPerCall: null,
  failedArchetypes: [],
};

describe("weekly progress — week window", () => {
  it("keeps only events inside [weekStart, weekStart + 7 days)", () => {
    const sims: SimMetricEvent[] = [
      { date: "2026-09-06", score: 100 }, // 8 days before weekStart → excluded
      { date: "2026-09-14", score: 80 }, // same day as weekStart → included
      { date: "2026-09-16", score: 90 }, // mid-week → included
      { date: "2026-09-21", score: 70 }, // first day of the next week → excluded
    ];
    const progress = weeklyProgress([], sims, WEEK_START);
    expect(progress.simCount).toBe(2);
    expect(progress.avgSimScore).toBe(85);
  });

  it("filters calls by the same window when counting failed archetypes", () => {
    const calls: CallMetricEvent[] = [
      makeCall({
        callId: "c1",
        date: "2026-09-14",
        failedArchetypes: ["expensive", "expensive", "expensive", "no_time"],
      }),
      makeCall({ callId: "c2", date: "2026-09-15", failedArchetypes: ["distrust_online", "distrust_online"] }),
      makeCall({ callId: "c3", date: "2026-09-06", failedArchetypes: ["let_me_think"] }), // out of window
    ];
    const progress = weeklyProgress(calls, [], WEEK_START);
    expect(progress.failedArchetypes).toEqual([
      { id: "expensive", count: 3 },
      { id: "distrust_online", count: 2 },
      { id: "no_time", count: 1 },
    ]);
  });
});

describe("weekly progress — rollup", () => {
  it("returns null metrics for empty inputs", () => {
    expect(weeklyProgress([], [], WEEK_START)).toEqual({
      simCount: 0,
      avgSimScore: null,
      talkRatio: null,
      stage4Rate: null,
      nextStepRate: null,
      kbLookupsPerCall: null,
      failedArchetypes: [],
    });
  });

  it("averages sim scores across multiple sims", () => {
    const sims: SimMetricEvent[] = [
      { date: "2026-09-14", score: 70 },
      { date: "2026-09-15", score: 80 },
      { date: "2026-09-17", score: 90 },
    ];
    expect(weeklyProgress([], sims, WEEK_START).avgSimScore).toBe(80);
  });

  it("computes 0.5 rates from two calls when only one fills stage 4", () => {
    const calls: CallMetricEvent[] = [
      makeCall({ callId: "c1", stage4Filled: true, nextStepConcrete: false, kbLookups: 2, talkRatio: 0.4 }),
      makeCall({ callId: "c2", stage4Filled: false, nextStepConcrete: true, kbLookups: 4, talkRatio: 0.6 }),
    ];
    const progress = weeklyProgress(calls, [], WEEK_START);
    expect(progress.stage4Rate).toBe(0.5);
    expect(progress.nextStepRate).toBe(0.5);
    expect(progress.kbLookupsPerCall).toBe(3);
    expect(progress.talkRatio).toBeCloseTo(0.5);
  });
});

describe("top 3 to improve", () => {
  it("returns no recommendations for an empty snapshot", () => {
    expect(top3ToImprove(emptyProgress)).toEqual([]);
  });

  it("prioritizes failed archetype, then stage 4, then next step", () => {
    const tips = top3ToImprove({
      ...emptyProgress,
      failedArchetypes: [{ id: "expensive", count: 4 }],
      stage4Rate: 0.5,
      nextStepRate: 0.5,
    });
    expect(tips).toHaveLength(3);
    const archIdx = tips.findIndex((t) => t.includes("Архетип «expensive»"));
    const stage4Idx = tips.findIndex((t) => t.includes("Етап 4"));
    const nextIdx = tips.findIndex((t) => t.includes("Next step"));
    expect(archIdx).toBe(0);
    expect(stage4Idx).toBeGreaterThan(archIdx);
    expect(nextIdx).toBeGreaterThan(stage4Idx);
  });

  it("caps the list at three tips", () => {
    const tips = top3ToImprove({
      ...emptyProgress,
      failedArchetypes: [
        { id: "expensive", count: 5 },
        { id: "no_time", count: 3 },
      ],
      stage4Rate: 0,
      nextStepRate: 0,
      avgSimScore: 60,
      kbLookupsPerCall: 0.5,
    });
    expect(tips).toHaveLength(3);
    expect(tips[0]).toContain("expensive");
    expect(tips[1]).toContain("no_time");
    expect(tips[2]).toContain("Етап 4");
  });
});

describe("manager auto flag", () => {
  it("flags an employment-promise violation", () => {
    expect(managerAutoFlag(makeCall({ promiseViolation: true }))).toEqual(["promise_block"]);
  });

  it("flags talk ratio over 75% (but not at exactly 75%)", () => {
    expect(managerAutoFlag(makeCall({ talkRatio: 0.8 }))).toEqual(["talk_ratio_over_75"]);
    expect(managerAutoFlag(makeCall({ talkRatio: 0.75 }))).toEqual([]);
  });

  it("stays quiet on a clean call", () => {
    expect(managerAutoFlag(makeCall())).toEqual([]);
  });

  it("combines both flags on a dirty call", () => {
    expect(managerAutoFlag(makeCall({ promiseViolation: true, talkRatio: 0.8 }))).toEqual([
      "promise_block",
      "talk_ratio_over_75",
    ]);
  });
});
