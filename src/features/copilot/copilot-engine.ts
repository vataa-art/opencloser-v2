// ============================================================
// Copilot engine — pure transcript-buffer logic for live assist.
// Decides WHEN to fire a copilot_turn: immediately on a prospect
// question, or after a silence pause; debounced by bookkeeping,
// not timers, so it stays unit-testable.
// ============================================================

export interface TranscriptLine {
  role: string;
  text: string;
}

export interface CopilotBufferState {
  /** Number of transcript lines already consumed by previous turns. */
  processedCount: number;
  /** Timestamp (ms) of the last fired turn, if any. */
  lastFiredAt: number | null;
}

export interface CopilotTriggerState extends CopilotBufferState {
  lastLineAt: number | null;
}

export interface CopilotTriggerDecision {
  fire: boolean;
  reason: "question" | "pause" | "none";
  nextState: CopilotTriggerState;
}

/** Silence after which pending prospect content triggers a turn. */
export const COPILOT_PAUSE_MS = 6000;

/** Hard cap on lines sent per turn — keeps prompts small. */
export const COPILOT_WINDOW_LINES = 12;

/** Last N transcript lines handed to copilot_turn. */
export function buildTranscriptWindow(
  lines: TranscriptLine[],
  max: number = COPILOT_WINDOW_LINES
): TranscriptLine[] {
  return lines.slice(-max);
}

function hasPendingProspectContent(
  lines: TranscriptLine[],
  processedCount: number
): boolean {
  return (
    lines.length > processedCount &&
    lines.slice(processedCount).some((l) => l.role === "user")
  );
}

/**
 * Decide whether the buffer warrants a copilot turn right now:
 * - "question": a NEW prospect line ends with "?" — fire immediately.
 * - "pause":    NEW prospect content and COPILOT_PAUSE_MS of silence
 *               since the last transcript line — fire once.
 * State advances processedCount only on fire, so nothing is swallowed.
 */
export function shouldFireCopilot(
  lines: TranscriptLine[],
  state: CopilotTriggerState,
  now: number,
  pauseMs: number = COPILOT_PAUSE_MS
): CopilotTriggerDecision {
  const fresh = lines.slice(state.processedCount);
  const prospectQuestion = fresh.find(
    (l) => l.role === "user" && l.text.trimEnd().endsWith("?")
  );

  if (prospectQuestion) {
    return {
      fire: true,
      reason: "question",
      nextState: { processedCount: lines.length, lastFiredAt: now, lastLineAt: state.lastLineAt },
    };
  }

  const pending = hasPendingProspectContent(lines, state.processedCount);
  const silence = state.lastLineAt !== null && now - state.lastLineAt >= pauseMs;
  if (pending && silence) {
    return {
      fire: true,
      reason: "pause",
      nextState: { processedCount: lines.length, lastFiredAt: now, lastLineAt: state.lastLineAt },
    };
  }

  return { fire: false, reason: "none", nextState: state };
}

/** Convenience: mark that a transcript line arrived at `now`. */
export function withLineAt(
  state: CopilotTriggerState,
  lines: TranscriptLine[],
  now: number
): CopilotTriggerState {
  return { ...state, processedCount: Math.min(state.processedCount, lines.length), lastLineAt: now };
}

export const initialCopilotState: CopilotTriggerState = {
  processedCount: 0,
  lastFiredAt: null,
  lastLineAt: null,
};
