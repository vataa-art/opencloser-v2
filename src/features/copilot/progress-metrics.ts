// ============================================================
// Weekly progress metrics for the recruit ("метрики прогресу
// новачка"): rolls call + sim events in a [weekStart,
// weekStart + 7 days) window into a snapshot, derives at most
// three Ukrainian recommendations and per-call manager flags.
// Pure logic — no React, no IO.
// ============================================================

export interface CallMetricEvent {
  callId: string;
  date: string; // ISO date string
  stage4Filled: boolean; // qualification stage captured
  nextStepConcrete: boolean; // concrete next step + date agreed
  kbLookups: number; // KB usage during the call
  failedArchetypes: string[]; // objection archetype ids the recruit failed
  talkRatio: number | null; // recruiter share 0..1; null when single audio channel
  promiseViolation: boolean; // employment-promise block triggered
}

export interface SimMetricEvent {
  date: string; // ISO
  score: number;
}

export interface WeeklyProgress {
  simCount: number;
  avgSimScore: number | null; // null when no sims in window
  talkRatio: number | null; // null unless calls carry non-null ratios
  stage4Rate: number | null; // 0..1; null when no calls in window
  nextStepRate: number | null; // 0..1; null when no calls
  kbLookupsPerCall: number | null; // null when no calls
  failedArchetypes: { id: string; count: number }[]; // sorted by count desc
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Events whose `date` falls in [weekStart, weekStart + 7 days). */
function inWindow<T extends { date: string }>(events: T[], weekStart: Date): T[] {
  const start = weekStart.getTime();
  const end = start + WEEK_MS;
  return events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= start && t < end;
  });
}

/** Arithmetic mean; null for an empty list. */
function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Rollup of the week's calls + sims; all rates null when the window has no events. */
export function weeklyProgress(
  calls: CallMetricEvent[],
  sims: SimMetricEvent[],
  weekStart: Date
): WeeklyProgress {
  const weekCalls = inWindow(calls, weekStart);
  const weekSims = inWindow(sims, weekStart);

  const talkRatios = weekCalls
    .map((c) => c.talkRatio)
    .filter((r): r is number => r !== null);

  const archetypeCounts = new Map<string, number>();
  for (const call of weekCalls) {
    for (const id of call.failedArchetypes) {
      archetypeCounts.set(id, (archetypeCounts.get(id) ?? 0) + 1);
    }
  }
  const failedArchetypes = Array.from(archetypeCounts, ([id, count]) => ({ id, count })).sort(
    (a, b) => b.count - a.count || a.id.localeCompare(b.id)
  );

  const callCount = weekCalls.length;
  return {
    simCount: weekSims.length,
    avgSimScore: mean(weekSims.map((s) => s.score)),
    talkRatio: mean(talkRatios),
    stage4Rate: callCount === 0 ? null : weekCalls.filter((c) => c.stage4Filled).length / callCount,
    nextStepRate:
      callCount === 0 ? null : weekCalls.filter((c) => c.nextStepConcrete).length / callCount,
    kbLookupsPerCall:
      callCount === 0 ? null : weekCalls.reduce((sum, c) => sum + c.kbLookups, 0) / callCount,
    failedArchetypes,
  };
}

/** Deterministic Ukrainian recommendations, at most 3, only for non-null weak spots. */
export function top3ToImprove(p: WeeklyProgress): string[] {
  const tips: string[] = [];
  for (const { id, count } of p.failedArchetypes) {
    tips.push(`Архетип «${id}»: ${count} провалів — відпрацюйте ще раз`);
  }
  if (p.stage4Rate !== null && p.stage4Rate < 1) {
    tips.push(
      `Етап 4 (кваліфікація) заповнюється не у всіх дзвінках (${Math.round(p.stage4Rate * 100)}%)`
    );
  }
  if (p.nextStepRate !== null && p.nextStepRate < 1) {
    tips.push(
      `Next step з конкретною датою є не у всіх дзвінках (${Math.round(p.nextStepRate * 100)}%)`
    );
  }
  if (p.avgSimScore !== null && p.avgSimScore < 70) {
    tips.push(`Середній бал симуляцій ${p.avgSimScore.toFixed(1)} < 70`);
  }
  if (p.kbLookupsPerCall !== null && p.kbLookupsPerCall < 1) {
    tips.push(`Мало звернень до KB під час дзвінків`);
  }
  return tips.slice(0, 3);
}

/** Compliance flags for a single call; empty when the call is clean. */
export function managerAutoFlag(call: CallMetricEvent): string[] {
  const flags: string[] = [];
  if (call.promiseViolation) flags.push("promise_block");
  if (call.talkRatio !== null && call.talkRatio > 0.75) flags.push("talk_ratio_over_75");
  return flags;
}
