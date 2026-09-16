// ============================================================
// Objection Detection + Coaching Engine
// Scans transcript for the 12 sales objection archetypes.
// Outputs: detected archetype only — the counter-script is generated
// by the CoachAgent (coach-agent.ts) from the knowledge base, so the
// static map intentionally carries no scripts anymore.
// ============================================================

export type ObjectionArchetype =
  | "price"
  | "timing"
  | "trust"
  | "authority"
  | "inertia"
  | "competitor"
  | "technical"
  | "roi"
  | "no_pain"
  | "wrong_fit"
  | "gatekeeper"
  | "voicemail";

export interface ObjectionMatch {
  archetype: ObjectionArchetype;
  label: string;
  emoji: string;
  trigger: string; // the phrase that triggered detection
  framework: string; // e.g. "Feel-Felt-Found"
  urgency: "low" | "medium" | "high";
}

const OBJECTION_MAP: {
  archetype: ObjectionArchetype;
  label: string;
  emoji: string;
  triggers: string[];
  framework: string;
  urgency: "low" | "medium" | "high";
}[] = [
  {
    archetype: "price",
    label: "Price Objection",
    emoji: "💰",
    triggers: ["too expensive", "can't afford", "no budget", "budget", "costs too much", "price", "pricey", "out of our range", "quote", "cheaper"],
    framework: "Feel-Felt-Found → ROI Reframe",
    urgency: "high",
  },
  {
    archetype: "timing",
    label: "Timing Objection",
    emoji: "⏰",
    triggers: ["not now", "not the right time", "maybe later", "bad time", "call me back", "next quarter", "not ready", "too soon", "wait", "year end"],
    framework: "Future-Pace + Urgency Probe",
    urgency: "high",
  },
  {
    archetype: "trust",
    label: "Trust / Credibility Objection",
    emoji: "🤝",
    triggers: ["never heard of you", "prove it", "who are you", "how do I know", "don't trust", "small company", "not sure about you", "reputation"],
    framework: "Social Proof + Risk Reversal",
    urgency: "medium",
  },
  {
    archetype: "authority",
    label: "Authority / Decision Maker",
    emoji: "👔",
    triggers: ["not my decision", "need to check", "need to ask", "have to talk to", "my boss", "my manager", "committee", "approval", "board", "sign off"],
    framework: "Champion-Building Question",
    urgency: "medium",
  },
  {
    archetype: "inertia",
    label: "Status Quo Objection",
    emoji: "😴",
    triggers: ["we're fine", "no problem", "doing okay", "works for us", "happy with what we have", "not looking", "no need", "satisfied", "current solution"],
    framework: "Gap + Implication Drill-Down",
    urgency: "medium",
  },
  {
    archetype: "competitor",
    label: "Competitor Objection",
    emoji: "⚔️",
    triggers: ["already use", "we have", "using competitor", "locked in", "contract with", "we're with", "switched to"],
    framework: "Curiosity-Led Differentiation",
    urgency: "medium",
  },
  {
    archetype: "technical",
    label: "Technical / How It Works",
    emoji: "🔧",
    triggers: ["how does it work", "technical details", "integration", "api", "how does this integrate", "can it connect", "setup", "implementation", "compatible"],
    framework: "Outcome-First Pivot",
    urgency: "low",
  },
  {
    archetype: "roi",
    label: "ROI / Value Objection",
    emoji: "📊",
    triggers: ["can't see value", "not sure it's worth it", "what's the roi", "prove the value", "show me the numbers", "return on investment", "hard to justify"],
    framework: "Quantified Pain Projection",
    urgency: "high",
  },
  {
    archetype: "no_pain",
    label: "No Perceived Pain",
    emoji: "🛡️",
    triggers: ["things are good", "no issues", "running smoothly", "don't have that problem", "no challenges", "all good", "not a priority"],
    framework: "Reframe Current Risk + Vision Question",
    urgency: "low",
  },
  {
    archetype: "wrong_fit",
    label: "Wrong Fit",
    emoji: "🎯",
    triggers: ["not relevant", "doesn't apply", "different industry", "different use case", "not for us", "not applicable", "we're not the right"],
    framework: "Re-Qualify or Graceful Release",
    urgency: "low",
  },
  {
    archetype: "gatekeeper",
    label: "Gatekeeper",
    emoji: "🚪",
    triggers: ["pass it along", "i'll forward", "send an email", "send some info", "forward your details", "leave your number", "not the right person", "try someone else"],
    framework: "Polite Redirect + Calendar Close",
    urgency: "medium",
  },
  {
    archetype: "voicemail",
    label: "Voicemail Detected",
    emoji: "📬",
    triggers: ["leave a message", "not available", "voicemail", "after the tone"],
    framework: "15-Second VM Script",
    urgency: "low",
  },
];

export function detectObjection(
  text: string
): ObjectionMatch | null {
  const lower = text.toLowerCase();
  for (const obj of OBJECTION_MAP) {
    for (const trigger of obj.triggers) {
      if (lower.includes(trigger)) {
        return {
          archetype: obj.archetype,
          label: obj.label,
          emoji: obj.emoji,
          trigger: trigger,
          framework: obj.framework,
          urgency: obj.urgency,
        };
      }
    }
  }
  return null;
}

export function detectObjectionInTranscript(
  entries: { role: string; text: string }[]
): ObjectionMatch | null {
  // Only check prospect/user lines, last 3 entries
  const recentProspect = entries
    .filter((e) => e.role === "user")
    .slice(-3);

  for (const entry of recentProspect.reverse()) {
    const match = detectObjection(entry.text);
    if (match) return match;
  }
  return null;
}
