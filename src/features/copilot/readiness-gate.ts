// ============================================================
// Readiness gate — допуск новачка до живих дзвінків.
// Pure evaluation + a localStorage tracker. Until the gate is
// passed, live-assist sessions run in SHADOW mode only.
// ============================================================

import { RECRUITMENT_ARCHETYPES } from "../../configs/objection-archetypes-recruitment";
import { SCREENING_FLOW } from "../../configs/screening-flow";

/** Rookie in ObjectionTrainer = difficulty "easy". */
export const ROOKIE_LEVEL = "easy";
const SIM_MIN_COUNT = 10;
const SIM_MIN_AVG_SCORE = 70;
const RECENT_WINDOW = 5;
const MIN_ARCHETYPES = 8;
const FLOW_STAGES_REQUIRED = SCREENING_FLOW.stages.filter((s) => s.id !== "post_call").map((s) => s.id);

export interface SimRecord {
  /** difficulty of the simulation ("easy" = Rookie). */
  level: string;
  score: number;
  /** Recruiter invented statistics during the sim. */
  fabricatedStatViolation: boolean;
  /** Recruiter promised employment ("гарантую роботу" тощо). */
  jobPromiseViolation: boolean;
}

export interface ReadinessStats {
  sims: SimRecord[];
  /** Archetype ids practiced at least once. */
  practicedArchetypeIds: string[];
  /** A full flow run (stages 1–7) without skipped blockers. */
  fullFlowRunCompleted: boolean;
}

export const emptyReadinessStats: ReadinessStats = {
  sims: [],
  practicedArchetypeIds: [],
  fullFlowRunCompleted: false,
};

export interface ReadinessUnmet {
  id: string;
  description: string;
}

export interface ReadinessVerdict {
  passed: boolean;
  unmet: ReadinessUnmet[];
}

/** Promise-of-employment phrasing that must never appear in a rookie call. */
export function detectJobPromiseViolation(text: string): boolean {
  return /гарант(у|і)ємо\s+роботу|100%\s+працевлаштування|обов'?язково\s+працевлаштуємо|працевлаштування\s+гарантоване/i.test(text);
}

export function evaluateReadiness(stats: ReadinessStats): ReadinessVerdict {
  const unmet: ReadinessUnmet[] = [];

  const rookie = stats.sims.filter((s) => s.level === ROOKIE_LEVEL);
  if (rookie.length < SIM_MIN_COUNT) {
    unmet.push({
      id: "sim_volume_avg_score",
      description: `Симуляцій Rookie: ${rookie.length}/${SIM_MIN_COUNT}, середній бал ≥${SIM_MIN_AVG_SCORE}`,
    });
  } else {
    const avg = rookie.reduce((sum, s) => sum + s.score, 0) / rookie.length;
    if (avg < SIM_MIN_AVG_SCORE) {
      unmet.push({
        id: "sim_volume_avg_score",
        description: `Середній бал Rookie ${avg.toFixed(1)} < ${SIM_MIN_AVG_SCORE}`,
      });
    }
  }

  const recent = stats.sims.slice(-RECENT_WINDOW);
  const recentViolations = recent.filter(
    (s) => s.fabricatedStatViolation || s.jobPromiseViolation
  ).length;
  // "Жодного порушення в останніх 5" implies the last-5 window must exist
  // and be clean — a short history does not satisfy the requirement.
  if (recent.length < RECENT_WINDOW || recentViolations > 0) {
    unmet.push({
      id: "no_violations_recent",
      description: `Порушення в останніх ${RECENT_WINDOW} симуляціях: ${recentViolations}`,
    });
  }

  const known = new Set(RECRUITMENT_ARCHETYPES.map((a) => a.id));
  const covered = stats.practicedArchetypeIds.filter((id) => known.has(id));
  const unique = new Set(covered);
  if (unique.size < MIN_ARCHETYPES) {
    unmet.push({
      id: "archetypes_coverage",
      description: `Архетипів відпрацьовано: ${unique.size}/${MIN_ARCHETYPES} (з ${known.size})`,
    });
  }

  if (!stats.fullFlowRunCompleted) {
    unmet.push({
      id: "full_flow_run",
      description: `Немає повного прогону флоу: ${FLOW_STAGES_REQUIRED[1]}…${FLOW_STAGES_REQUIRED[FLOW_STAGES_REQUIRED.length - 1]} (етапи 1–7)`,
    });
  }

  return { passed: unmet.length === 0, unmet };
}

// ── localStorage tracker ────────────────────────────────────

const STORAGE_KEY = "copilot-readiness-stats";

export function loadReadinessStats(): ReadinessStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...emptyReadinessStats, ...JSON.parse(raw) };
  } catch {
    // corrupted storage — start fresh rather than blocking the user
  }
  return { ...emptyReadinessStats };
}

function saveStats(stats: ReadinessStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage unavailable (private mode) — session-only tracking
  }
}

export function recordSimResult(entry: SimRecord): ReadinessStats {
  const stats = loadReadinessStats();
  stats.sims = [...stats.sims, entry];
  saveStats(stats);
  return stats;
}

export function recordArchetypePractice(archetypeId: string): ReadinessStats {
  const stats = loadReadinessStats();
  if (!stats.practicedArchetypeIds.includes(archetypeId)) {
    stats.practicedArchetypeIds = [...stats.practicedArchetypeIds, archetypeId];
    saveStats(stats);
  }
  return stats;
}

export function recordFullFlowRun(): ReadinessStats {
  const stats = loadReadinessStats();
  stats.fullFlowRunCompleted = true;
  saveStats(stats);
  return stats;
}

/** Record a full flow run only when stages 1–7 all completed. */
export function maybeRecordFullFlowRun(completedStages: string[]): ReadinessStats | null {
  if (FLOW_STAGES_REQUIRED.every((id) => completedStages.includes(id))) {
    return recordFullFlowRun();
  }
  return null;
}
