// ============================================================
// War Room logic — pure helpers for sentiment, coaching, phases,
// and system-prompt construction. No React, no side effects
// except loadPersona()'s settings read.
// ============================================================

import type { Lead, ICP } from "../../../../types";
import { AIPersona, DEFAULT_PERSONA } from "../../../../types/persona";
import { buildEmotionSystemPrompt, EmotionAxes } from "../../lib/emotion-engine";

export type SentimentLevel = "hostile" | "cold" | "skeptical" | "neutral" | "warming" | "buying";

export const SENTIMENT_CONFIG: Record<SentimentLevel, { label: string; emoji: string; color: string; bg: string }> = {
  hostile:   { label: "Hostile",   emoji: "😤", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
  cold:      { label: "Cold",      emoji: "❄️", color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
  skeptical: { label: "Skeptical", emoji: "🤔", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  neutral:   { label: "Neutral",   emoji: "😐", color: "text-gray-400",   bg: "bg-white/5 border-white/10" },
  warming:   { label: "Warming",   emoji: "🙂", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  buying:    { label: "Buying",    emoji: "🔥", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
};

export const SENTIMENT_ORDER: SentimentLevel[] = ["hostile", "cold", "skeptical", "neutral", "warming", "buying"];

export function getSentimentFromMood(mood: string): SentimentLevel {
  const m = mood.toLowerCase();
  if (m.includes("hostile")) return "hostile";
  if (m.includes("frustrat")) return "cold";
  if (m.includes("disengag")) return "skeptical";
  if (m.includes("hesitant")) return "skeptical";
  if (m.includes("interested")) return "warming";
  if (m.includes("buying")) return "buying";
  return "neutral";
}

/** Persona from settings storage, or the built-in default. */
export function loadPersona(): AIPersona {
  try {
    const s = localStorage.getItem("ai_persona");
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_PERSONA;
}

export function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function getCallPhase(callState: string, transcriptLength: number): { label: string; color: string } {
  if (callState === "objection_mode") return { label: "⚡ Objection", color: "text-orange-400" };
  if (callState === "closing") return { label: "🏁 Closing", color: "text-amber-400" };
  const n = transcriptLength;
  if (n === 0) return { label: "Connecting", color: "text-yellow-400" };
  if (n < 4) return { label: "Opening", color: "text-blue-400" };
  if (n < 8) return { label: "Discovery", color: "text-purple-400" };
  if (n < 12) return { label: "Pitch", color: "text-emerald-400" };
  return { label: "🏁 Close", color: "text-amber-400" };
}

export function buildCoachingHints(
  transcript: { role: "user" | "model"; text: string }[],
  elapsedSeconds: number,
  coachHints: string[] = []
): string[] {
  const hints: string[] = [];
  const n = transcript.length;
  const userMsgs = transcript.filter(t => t.role === "user").length;
  const aiMsgs = transcript.filter(t => t.role === "model").length;

  if (n === 0) { hints.push("🎯 Opening: Build rapport fast. Mirror their energy."); return hints; }

  // Stage-by-stage threshold scripts are gone: KB-grounded coaching comes
  // from the CoachAgent (debounced) — see coach-agent.ts in ../lib.
  hints.push(...coachHints);

  if (aiMsgs > userMsgs * 2 && n > 3) hints.push("⚠️ AI is talking too much. Ask a question and actually listen.");
  if (elapsedSeconds > 300) hints.push("⏱️ 5+ min call. Pivot to the close. Don't let it drift.");

  return hints;
}

export function buildCallSystemPrompt(
  personaData: AIPersona,
  currentAxes: EmotionAxes | null,
  icp: ICP | null,
  lead: Lead
): string {
  const axes: EmotionAxes = currentAxes || {
    empathy: personaData.emotionalModulation.empathy,
    energy: personaData.emotionalModulation.energy,
    formality: personaData.emotionalModulation.formality,
    assertiveness: personaData.emotionalModulation.assertiveness ?? 45,
    humor: personaData.emotionalModulation.humor ?? 30,
  };

  const baseInstruction = icp?.systemPrompt
    ? `You are calling ${lead.name} at ${lead.company}. ${icp.systemPrompt}`
    : `You are an elite AI Sales Development Representative calling ${lead.name} at ${lead.company}. Your goal is to qualify them and book a meeting.`;

  const frameworkPrompt = `SALES FRAMEWORK (${personaData.framework}): ${
    personaData.framework === "SPIN Selling"
      ? "Use Situation → Problem → Implication → Need-Payoff questions in sequence. Uncover the pain deeply before you mention your solution."
      : personaData.framework === "Challenger Sale"
      ? "Teach them something counterintuitive about their industry first. Challenge their assumptions. Reframe the problem before presenting your solution."
      : personaData.framework === "Sandler System"
      ? "Establish an upfront contract. Qualify pain, budget, and decision process BEFORE presenting anything. Be willing to walk away."
      : "Maintain momentum. Maintain certainty in yourself, your product, and the process. Move in a straight line toward yes or no. Never loop."
  }`;

  const emotionPrompt = buildEmotionSystemPrompt(axes, personaData.speechPatterns);

  const icpContext = icp ? `
=== ICP INTELLIGENCE (USE ONLY THIS — DO NOT FABRICATE) ===
Industry: ${icp.industry || "Not specified"}
Company Size Target: ${icp.companySize || "Not specified"}
Decision Maker Titles: ${icp.decisionMakerTitles?.join(", ") || "Not specified"}
Pain Points: ${icp.painPoints?.join(" | ") || "Not specified"}
Known Objections: ${icp.objections?.join(" | ") || "Not specified"}
Competitors: ${icp.competitorNames?.join(", ") || "Not specified"}
Value Proposition: ${icp.valueProposition || "Not specified"}` : "";

  const antiHallucination = `
=== ABSOLUTE RULES (ZERO TOLERANCE) ===
1. NEVER fabricate statistics, percentages, ROI figures, case studies, or customer names.
2. NEVER claim the product does something not stated in your ICP intelligence above.
3. If asked something you don't know: "Great question — I want to get you the exact answer. Let me have our team follow up with specifics."
4. NEVER make up competitor comparisons.
5. Sound HUMAN. Not robotic. Not scripted. Natural.`;

  return `${baseInstruction}\n\n${frameworkPrompt}\n\n${emotionPrompt}\n\n${icpContext}\n\n${antiHallucination}`;
}
