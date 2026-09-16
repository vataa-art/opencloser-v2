// Contract tests for War Room call logic: system prompt construction,
// sentiment mapping, coaching hints, and call phases.

import { describe, expect, it } from "vitest";
import type { AIPersona } from "../types/persona";
import { DEFAULT_PERSONA } from "../types/persona";
import type { Lead } from "../types";
import {
  buildCallSystemPrompt,
  buildCoachingHints,
  formatTimer,
  getCallPhase,
  getSentimentFromMood,
} from "../features/voice/components/warroom/warroom-logic";

const lead: Lead = {
  id: "lead_1",
  name: "Sarah Jenkins",
  company: "Acme Heavy Industries",
  phone: "+1 (512) 555-0101",
  email: "",
  title: "",
  linkedin_url: "",
  notes: "",
  industry: "",
  status: "Discovery",
  score: 85,
  created_at: "",
};

function persona(overrides: Partial<AIPersona> = {}): AIPersona {
  return { ...DEFAULT_PERSONA, ...overrides };
}

describe("war room logic", () => {
  it("formats the call timer as mm:ss", () => {
    expect(formatTimer(0)).toBe("00:00");
    expect(formatTimer(75)).toBe("01:15");
    expect(formatTimer(600)).toBe("10:00");
  });

  it("maps emotion moods onto sentiment levels", () => {
    expect(getSentimentFromMood("Hostile and dismissive")).toBe("hostile");
    expect(getSentimentFromMood("Interested but cautious")).toBe("warming");
    expect(getSentimentFromMood("Showing clear buying signals")).toBe("buying");
    expect(getSentimentFromMood("somewhere in between")).toBe("neutral");
  });

  it("derives call phases from state and transcript length", () => {
    expect(getCallPhase("objection_mode", 10).label).toContain("Objection");
    expect(getCallPhase("active", 0).label).toBe("Connecting");
    expect(getCallPhase("active", 5).label).toBe("Discovery");
    expect(getCallPhase("active", 20).label).toContain("Close");
  });

  it("uses CoachAgent hints instead of stage thresholds", () => {
    const empty = buildCoachingHints([], 10);
    expect(empty[0]).toContain("Opening");

    // Stage thresholds are gone — mid-call transcript yields no local
    // hints beyond CoachAgent-provided ones.
    const midCall = buildCoachingHints(
      [...Array(12)].map((_, i) => ({ role: "user" as const, text: `line ${i}` })),
      30
    );
    expect(midCall).toHaveLength(0);

    const withCoach = buildCoachingHints(
      [...Array(8)].map((_, i) => ({ role: "user" as const, text: `line ${i}` })),
      30,
      ["📚 KB-grounded hint from CoachAgent [KB: vHG4m5ptmJs]"]
    );
    expect(withCoach.some((h) => h.includes("CoachAgent"))).toBe(true);

    const overTalk = buildCoachingHints(
      [
        { role: "model", text: "a" },
        { role: "model", text: "b" },
        { role: "user", text: "c" },
        { role: "model", text: "d" },
      ],
      400
    );
    expect(overTalk.some((h) => h.includes("talking too much"))).toBe(true);
    expect(overTalk.some((h) => h.includes("5+ min"))).toBe(true);
  });

  it("builds a system prompt with framework, ICP context, and guardrails", () => {
    const icp = {
      industry: "Commercial Construction",
      painPoints: ["Denied equipment claims"],
      objections: ["We have a broker"],
      valueProposition: "Close coverage gaps",
      systemPrompt: "Sell contractor insurance.",
    } as any;

    const prompt = buildCallSystemPrompt(persona({ framework: "SPIN Selling" }), null, icp, lead);

    expect(prompt).toContain("calling Sarah Jenkins at Acme Heavy Industries");
    expect(prompt).toContain("SALES FRAMEWORK (SPIN Selling)");
    expect(prompt).toContain("Denied equipment claims");
    expect(prompt).toContain("NEVER fabricate statistics");
  });

  it("falls back to a default instruction when no ICP exists", () => {
    const prompt = buildCallSystemPrompt(persona({ framework: "Challenger Sale" }), null, null, lead);
    expect(prompt).toContain("AI Sales Development Representative");
    expect(prompt).toContain("SALES FRAMEWORK (Challenger Sale)");
    expect(prompt).not.toContain("ICP INTELLIGENCE");
  });
});
