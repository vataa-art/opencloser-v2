import { describe, it, expect } from "vitest";
import {
  ROOKIE_LEVEL,
  detectJobPromiseViolation,
  emptyReadinessStats,
  evaluateReadiness,
  type ReadinessStats,
  type SimRecord,
} from "../features/copilot/readiness-gate";
import { RECRUITMENT_ARCHETYPES } from "../configs/objection-archetypes-recruitment";

const rookieSim = (score: number, overrides: Partial<SimRecord> = {}): SimRecord => ({
  level: "easy",
  score,
  fabricatedStatViolation: false,
  jobPromiseViolation: false,
  ...overrides,
});

/** 10 clean Rookie sims above the score bar + 8 practiced archetypes + a full flow run. */
const readyStats = (): ReadinessStats => ({
  sims: Array.from({ length: 10 }, () => rookieSim(82)),
  practicedArchetypeIds: RECRUITMENT_ARCHETYPES.slice(0, 8).map((a) => a.id),
  fullFlowRunCompleted: true,
});

describe("readiness gate — rookie volume and average score", () => {
  it("Rookie is the easy level", () => {
    expect(ROOKIE_LEVEL).toBe("easy");
  });

  it("fails empty stats with all four requirements unmet", () => {
    const verdict = evaluateReadiness(emptyReadinessStats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual([
      "sim_volume_avg_score",
      "no_violations_recent",
      "archetypes_coverage",
      "full_flow_run",
    ]);
  });

  it("passes with exactly 10 Rookie sims at 70+, 8 archetypes and a full flow run", () => {
    const verdict = evaluateReadiness(readyStats());
    expect(verdict.passed).toBe(true);
    expect(verdict.unmet).toHaveLength(0);
  });

  it("fails with 9 Rookie sims even when every other requirement is met", () => {
    const base = readyStats();
    const stats: ReadinessStats = { ...base, sims: base.sims.slice(1) };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["sim_volume_avg_score"]);
    expect(verdict.unmet[0].description).toContain("9/10");
  });

  it("fails when the Rookie average is below 70 and reports it", () => {
    const stats: ReadinessStats = {
      ...readyStats(),
      sims: [
        ...Array.from({ length: 5 }, () => rookieSim(60)),
        ...Array.from({ length: 5 }, () => rookieSim(69)),
      ],
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["sim_volume_avg_score"]);
    expect(verdict.unmet[0].description).toContain("64.5");
  });

  it("does not let non-Rookie levels satisfy the volume requirement", () => {
    const stats: ReadinessStats = {
      ...readyStats(),
      sims: Array.from({ length: 10 }, () => rookieSim(90, { level: "medium" })),
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["sim_volume_avg_score"]);
    expect(verdict.unmet[0].description).toContain("0/10");
  });
});

describe("readiness gate — recent-violations window", () => {
  it("counts non-Rookie sims in the recent-violations window", () => {
    const base = readyStats();
    const stats: ReadinessStats = {
      ...base,
      // The medium sim is clean on volume but lands in the last-5 window.
      sims: [...base.sims, rookieSim(90, { level: "medium", jobPromiseViolation: true })],
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["no_violations_recent"]);
  });

  it("blocks on a job-promise violation in the last 5 sims", () => {
    const base = readyStats();
    const stats: ReadinessStats = {
      ...base,
      sims: base.sims.map((sim, i) =>
        i === base.sims.length - 1 ? { ...sim, jobPromiseViolation: true } : sim
      ),
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["no_violations_recent"]);
  });

  it("ignores a violation that falls out of the last-5 window", () => {
    const base = readyStats();
    const stats: ReadinessStats = {
      ...base,
      sims: base.sims.map((sim, i) =>
        i === 0 ? { ...sim, fabricatedStatViolation: true } : sim
      ),
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(true);
    expect(verdict.unmet).toHaveLength(0);
  });
});

describe("readiness gate — archetypes coverage", () => {
  it("requires at least 8 distinct known archetypes", () => {
    const base = readyStats();
    const stats: ReadinessStats = {
      ...base,
      // 7 real archetype ids + one unknown id the engine must ignore.
      practicedArchetypeIds: [
        ...RECRUITMENT_ARCHETYPES.slice(0, 7).map((a) => a.id),
        "not_a_real_archetype",
      ],
    };
    const verdict = evaluateReadiness(stats);
    expect(verdict.passed).toBe(false);
    expect(verdict.unmet.map((u) => u.id)).toEqual(["archetypes_coverage"]);
    expect(verdict.unmet[0].description).toContain("7/8");
  });
});

describe("job promise detection", () => {
  it("flags guaranteed-employment phrasing", () => {
    expect(detectJobPromiseViolation("Ми гарантуємо роботу після курсу")).toBe(true);
    expect(detectJobPromiseViolation("У нас 100% працевлаштування")).toBe(true);
    expect(detectJobPromiseViolation("Ми обов'язково працевлаштуємо вас")).toBe(true);
  });

  it("does not flag honest employment framing", () => {
    expect(detectJobPromiseViolation("Працевлаштування залежить від ваших зусиль")).toBe(false);
  });
});
