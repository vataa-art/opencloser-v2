// ============================================================
// Guided screening flow engine ("те, що тримає за руку новачка").
// Pure logic over the screening-flow config: stage gating on
// blocking questions, next-best-question, forbidden-topic hard
// block, and red-flag detection. No React, no side effects.
// ============================================================

import { SCREENING_FLOW, type FlowQuestion, type ScreeningFlow } from "../../configs/screening-flow";
import { RECRUITMENT_ARCHETYPES } from "../../configs/objection-archetypes-recruitment";

export { SCREENING_FLOW };
export type { ScreeningFlow, FlowQuestion };

/** Progress of one call through the managed flow. */
export interface FlowProgress {
  /** Question ids confirmed by the recruiter. */
  checked: string[];
  /** Stage ids whose blockers are fully satisfied. */
  completedStages: string[];
  /** Index into SCREENING_FLOW.stages. */
  currentStageIndex: number;
}

export const initialFlowProgress: FlowProgress = {
  checked: [],
  completedStages: [],
  currentStageIndex: 0,
};

export function currentStage(flow: ScreeningFlow, progress: FlowProgress) {
  return flow.stages[Math.min(progress.currentStageIndex, flow.stages.length - 1)];
}

/** All blocking questions of the current stage are checked? */
export function stageBlockersSatisfied(stage: { blocking_questions: FlowQuestion[] }, checked: string[]): boolean {
  return stage.blocking_questions.every((q) => checked.includes(q.id));
}

/**
 * Copilot lets the recruiter advance only when every blocking question of
 * the current stage is checked. Advancing marks the stage completed and
 * stops at the last stage.
 */
export function advanceStage(flow: ScreeningFlow, progress: FlowProgress): FlowProgress {
  const stage = currentStage(flow, progress);
  if (!stageBlockersSatisfied(stage, progress.checked)) {
    return progress; // gated — no silent skip
  }
  const completedStages = progress.completedStages.includes(stage.id)
    ? progress.completedStages
    : [...progress.completedStages, stage.id];
  return {
    ...progress,
    completedStages,
    currentStageIndex: Math.min(progress.currentStageIndex + 1, flow.stages.length - 1),
  };
}

export function toggleQuestion(progress: FlowProgress, questionId: string): FlowProgress {
  const checked = progress.checked.includes(questionId)
    ? progress.checked.filter((id) => id !== questionId)
    : [...progress.checked, questionId];
  return { ...progress, checked };
}

/** "Наступне найкраще питання" — the first unchecked blocker of the current stage. */
export function nextBestQuestion(
  flow: ScreeningFlow,
  progress: FlowProgress
): { stageTitle: string; question: FlowQuestion } | null {
  const stage = currentStage(flow, progress);
  const question = stage.blocking_questions.find((q) => !progress.checked.includes(q.id));
  return question ? { stageTitle: stage.title, question } : null;
}

/** Keyword patterns per forbidden topic (hard block, not a hint).
 *  \b is ASCII-only in JS regex, so Cyrillic word edges use \p{L} lookarounds. */
const FORBIDDEN_PATTERNS: { topic: string; re: RegExp }[] = [
  { topic: "вік", re: /скільки\s+(?:вам|тобі)?\s*років|(?<![\p{L}])вік(?![\p{L}])|(?<![\p{L}])віку(?![\p{L}])/iu },
  { topic: "сімейний стан", re: /сімейний\s+стан|одружен|заміж|розлучен/i },
  { topic: "діти", re: /(?<![\p{L}])(?:діти|донька)(?![\p{L}])|(?<![\p{L}])дитин|(?<![\p{L}])син(?![\p{L}])/u },
  { topic: "вагітність", re: /вагітн/i },
  { topic: "національність", re: /національн|етнічн/i },
  { topic: "релігія", re: /релігі|віросповід|церкв/i },
  { topic: "стан здоров'я", re: /здоров'|хвороб|інвалід|діагноз|хворіє/i },
  { topic: "політичні погляди", re: /політичн|погляди\s+на\s+(війну|політику)/i },
];

/**
 * Hard block: returns the matched forbidden topic, or null. Used both to
 * stop the recruiter from ASKING forbidden questions (manual/transcript
 * input) and to keep them out of any suggestion path.
 */
export function detectForbiddenTopic(text: string): string | null {
  for (const { topic, re } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) return topic;
  }
  return null;
}

/** Inputs the red-flag rules need; missing data means "not evaluated". */
export interface RedFlagInput {
  /** Recruiter share of talk time, 0..1 (null when only one channel). */
  talkRatio: number | null;
  quotedPrice: boolean;
  quotedStartDate: boolean;
  consentConfirmed: boolean;
}

/** Evaluate the flow's red-flag rules against a session snapshot. */
export function computeRedFlags(
  flow: ScreeningFlow,
  progress: FlowProgress,
  input: RedFlagInput
): { id: string; description: string }[] {
  const flagged: { id: string; description: string }[] = [];
  const byId = (id: string) => flow.red_flags.find((f) => f.id === id)?.description ?? id;

  if (input.talkRatio !== null && input.talkRatio > 0.65) {
    flagged.push({ id: "talk_ratio_over_65", description: byId("talk_ratio_over_65") });
  }
  if (!progress.completedStages.includes("qualification")) {
    flagged.push({ id: "qualification_skipped", description: byId("qualification_skipped") });
  }
  if (input.quotedPrice && !input.quotedStartDate) {
    flagged.push({ id: "price_without_start_date", description: byId("price_without_start_date") });
  }
  if (!progress.completedStages.includes("next_step")) {
    flagged.push({ id: "next_step_without_date", description: byId("next_step_without_date") });
  }
  if (!input.consentConfirmed) {
    flagged.push({ id: "consent_not_confirmed", description: byId("consent_not_confirmed") });
  }
  return flagged;
}

export interface RecruitmentObjectionMatch {
  id: string;
  label: string;
  core_response: string;
  framework: string;
  urgency: "low" | "medium" | "high";
}

/** Detect recruitment-domain objection archetypes in prospect text. */
export function detectRecruitmentObjection(text: string): RecruitmentObjectionMatch | null {
  const lower = text.toLowerCase();
  for (const archetype of RECRUITMENT_ARCHETYPES) {
    if (archetype.triggers.some((t) => lower.includes(t))) {
      return {
        id: archetype.id,
        label: archetype.label,
        core_response: archetype.core_response,
        framework: archetype.framework,
        urgency: archetype.urgency,
      };
    }
  }
  return null;
}
