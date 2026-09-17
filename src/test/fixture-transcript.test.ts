import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { buildSalesDebrief } from "../features/crm/lib/debrief";
import { detectObjection } from "../features/voice/lib/objection-engine";
import { coachAdvise } from "../features/voice/lib/coach-agent";
import { kbSearch } from "../services/kb.service";

vi.mock("../services/kb.service", () => ({ kbSearch: vi.fn() }));
const mockedKbSearch = vi.mocked(kbSearch);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturePath = resolve(__dirname, "fixtures", "sales-call.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
const transcript = fixture.transcript;

describe("Sales fixture transcript", () => {
  it("buildSalesDebrief works correctly", () => {
    const debrief = buildSalesDebrief(transcript);
    
    // has unaddressed price
    const hasUnaddressedPrice = debrief.objections.some((o: any) => o.archetype === "price" && !o.addressed);
    expect(hasUnaddressedPrice).toBe(true);

    // has addressed competitor
    const compObj = debrief.objections.find((o: any) => o.archetype === "competitor");
    expect(compObj).toBeDefined();
    expect(compObj?.addressed).toBe(true);

    // next_step is null
    expect(debrief.next_step).toBeNull();

    // risks include no_next_step
    expect(debrief.risks).toContain("no_next_step");
    // risks do NOT include monologue
    expect(debrief.risks).not.toContain("monologue");
  });

  it("detectObjection returns archetype price", () => {
    const priceLine = transcript.find((t: any) => t.text.includes("too expensive"));
    const match = detectObjection(priceLine.text);
    expect(match?.archetype).toBe("price");
  });

  it("coachAdvise with empty KB flags invented numbers", async () => {
    mockedKbSearch.mockResolvedValue({ results: [], embedder: "local-hash-256" });
    const advice = await coachAdvise({ objection: null, transcript });
    
    expect(advice.hints.join(" ")).toMatch(/don't invent a number/i);
    
    const raws = advice.flaggedClaims.map((c: any) => c.raw.toLowerCase());
    expect(raws.some((r: string) => r.includes("499"))).toBe(true);
    expect(raws.some((r: string) => r.includes("guarantee"))).toBe(true);
  });

  it("coachAdvise with KB text containing $499 and guarantee does not flag", async () => {
    mockedKbSearch.mockResolvedValue({
      results: [
        { source: "doc1", text: "It costs $499 per month. We guarantee your success.", score: 0.9 }
      ],
      embedder: "local-hash-256"
    });
    
    const advice = await coachAdvise({ objection: null, transcript });
    
    const raws = advice.flaggedClaims.map((c: any) => c.raw.toLowerCase());
    expect(raws.some((r: string) => r.includes("499"))).toBe(false);
    expect(raws.some((r: string) => r.includes("guarantee"))).toBe(false);
  });
});
