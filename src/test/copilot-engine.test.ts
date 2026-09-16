import { describe, it, expect } from "vitest";
import {
  buildTranscriptWindow,
  initialCopilotState,
  shouldFireCopilot,
  withLineAt,
  COPILOT_PAUSE_MS,
} from "../features/copilot/copilot-engine";

const userLine = (text: string) => ({ role: "user", text });
const modelLine = (text: string) => ({ role: "model", text });

describe("buildTranscriptWindow", () => {
  it("keeps only the last N lines", () => {
    const lines = Array.from({ length: 30 }, (_, i) => userLine(`line ${i}`));
    const window = buildTranscriptWindow(lines, 12);
    expect(window).toHaveLength(12);
    expect(window[0].text).toBe("line 18");
    expect(window[11].text).toBe("line 29");
  });
});

describe("shouldFireCopilot — question trigger", () => {
  it("fires immediately on a new prospect question", () => {
    const lines = [userLine("Hi"), userLine("What is an API?")];
    const decision = shouldFireCopilot(lines, initialCopilotState, 1000);
    expect(decision.fire).toBe(true);
    expect(decision.reason).toBe("question");
    expect(decision.nextState.processedCount).toBe(2);
  });

  it("does not fire for questions already processed", () => {
    const lines = [userLine("What is an API?")];
    const state = { processedCount: 1, lastFiredAt: 1000, lastLineAt: 900 };
    const decision = shouldFireCopilot(lines, state, 5000);
    expect(decision.fire).toBe(false);
    expect(decision.reason).toBe("none");
  });

  it("ignores agent (model) questions", () => {
    const lines = [modelLine("Does that make sense?")];
    const decision = shouldFireCopilot(lines, initialCopilotState, 1000);
    expect(decision.fire).toBe(false);
  });

  it("does not fire a pause turn for agent-only updates", () => {
    const lines = [modelLine("Let me check.")];
    const state = withLineAt(initialCopilotState, lines, 1000);
    const decision = shouldFireCopilot(lines, state, 1000 + COPILOT_PAUSE_MS + 1);
    expect(decision.fire).toBe(false);
  });
});

describe("shouldFireCopilot — pause trigger", () => {
  it("fires once after silence when prospect content is pending", () => {
    const lines = [userLine("We need something cheaper but reliable")];
    const afterLine = withLineAt(initialCopilotState, lines, 1000);
    const notYet = shouldFireCopilot(lines, afterLine, 1000 + COPILOT_PAUSE_MS - 1);
    expect(notYet.fire).toBe(false);

    const fired = shouldFireCopilot(lines, afterLine, 1000 + COPILOT_PAUSE_MS);
    expect(fired.fire).toBe(true);
    expect(fired.reason).toBe("pause");
    expect(fired.nextState.processedCount).toBe(1);
  });

  it("does not re-fire the same pending content twice", () => {
    const lines = [userLine("no question here")];
    const afterLine = withLineAt(initialCopilotState, lines, 1000);
    const fired = shouldFireCopilot(lines, afterLine, 1000 + COPILOT_PAUSE_MS);
    expect(fired.fire).toBe(true);
    const again = shouldFireCopilot(lines, fired.nextState, 1000 + 2 * COPILOT_PAUSE_MS);
    expect(again.fire).toBe(false);
  });
});
