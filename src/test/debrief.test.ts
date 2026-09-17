import { describe, expect, it } from "vitest";
import { buildSalesDebrief, talkRatio } from "../features/crm/lib/debrief";

describe("sales debrief heuristic", () => {
  it("flags unanswered competitor objection and missing next step", () => {
    const d = buildSalesDebrief([
      { role: "user", text: "We already use your competitor." },
      { role: "model", text: "Well, thanks for your time." },
    ]);
    expect(d.objections.some((o) => o.archetype === "competitor" && o.addressed === false)).toBe(
      true,
    );
    expect(d.next_step).toBeNull();
    expect(d.risks).toContain("no_next_step");
  });

  it("marks monologue when the agent dominates word count", () => {
    const agent = { role: "model", text: Array(80).fill("pitch").join(" ") };
    const d = buildSalesDebrief([agent, { role: "user", text: "Ok." }]);
    expect(talkRatio([agent, { role: "user", text: "Ok." }])).toBeGreaterThan(0.9);
    expect(d.risks).toContain("monologue");
  });

  it("treats a substantial model reply as addressed and accepts a dated next step", () => {
    const d = buildSalesDebrief([
      { role: "user", text: "It's too expensive for us right now." },
      {
        role: "model",
        text: "I hear the budget concern. Let's compare cost against the time you spend today and pick a Tuesday follow-up.",
      },
    ]);
    const price = d.objections.find((o) => o.archetype === "price");
    expect(price?.addressed).toBe(true);
    expect(d.next_step).not.toBeNull();
    expect(d.risks).not.toContain("no_next_step");
  });
});
