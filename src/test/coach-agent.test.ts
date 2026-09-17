import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/kb.service", () => ({ kbSearch: vi.fn() }));

import { kbSearch } from "../services/kb.service";
import {
  coachAdvise,
  createDebouncedCoach,
  extractStatClaims,
  flagUnverifiedClaims,
} from "../features/voice/lib/coach-agent";
import type { ObjectionMatch } from "../features/voice/lib/objection-engine";

const mockedKbSearch = vi.mocked(kbSearch);

const objection: ObjectionMatch = {
  archetype: "price",
  label: "Price Objection",
  emoji: "💰",
  trigger: "too expensive",
  framework: "Feel-Felt-Found → ROI Reframe",
  urgency: "high",
};

describe("extractStatClaims", () => {
  it("finds percents, multiples and ratios", () => {
    const claims = extractStatClaims(
      "Our clients typically see 3x more meetings and a 73% close rate; 10 out of 15 pilots convert."
    );
    const raws = claims.map((c) => c.raw);
    expect(raws).toContain("3x");
    expect(raws).toContain("73%");
    expect(raws).toContain("10 out of 15");
    expect(claims.find((c) => c.raw === "3x")?.kind).toBe("multiple");
  });

  it("ignores plain numbers like years and counts", () => {
    expect(extractStatClaims("We started in 2024 with 12 people")).toHaveLength(0);
  });

  it("returns no duplicates", () => {
    const claims = extractStatClaims("3x growth, again 3x growth");
    expect(claims).toHaveLength(1);
  });
});

describe("flagUnverifiedClaims — fabricated statistics must be flagged", () => {
  it("flags a statistic absent from KB chunks", () => {
    const kb = [
      "Our data shows 27% average reply rate on warm outreach sequences.",
      "Clients typically run a 90-day pilot before scaling.",
    ];
    const flagged = flagUnverifiedClaims(
      extractStatClaims("Our solution delivers 3x ROI in the first month."),
      kb
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0].raw).toBe("3x");
    expect(flagged[0].reason).toContain("not backed");
  });

  it("does not flag statistics present in the KB", () => {
    const kb = ["Teams see 3x pipeline growth after the first quarter."];
    const flagged = flagUnverifiedClaims(extractStatClaims("You could get 3x pipeline growth."), kb);
    expect(flagged).toHaveLength(0);
  });

  it("does not let a substring figure verify a claim (3x vs 13x, 7% vs 27%)", () => {
    const kb = ["Clients report 13x productivity and 27% savings."];
    const flagged = flagUnverifiedClaims(
      extractStatClaims("We deliver 3x productivity and 7% savings."),
      kb
    );
    expect(flagged.map((c) => c.raw).sort()).toEqual(["3x", "7%"]);
  });
});

describe("coachAdvise", () => {
  beforeEach(() => {
    mockedKbSearch.mockReset();
  });

  it("composes counter-script from top KB hit with source attribution", async () => {
    mockedKbSearch.mockResolvedValue({
      results: [
        { source: "vHG4m5ptmJs", text: "An API design defines how components exchange data reliably.", score: 0.8 },
        { source: "imB5mYQHHi4", text: " recruiters screen for communication.", score: 0.4 },
      ],
      embedder: "local-hash-256",
    });

    const advice = await coachAdvise({ objection, transcript: [] });

    expect(mockedKbSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining("too expensive"), domain: "sales", k: 3 })
    );
    expect(advice.counterScript).toContain("Feel-Felt-Found");
    expect(advice.counterScript).toContain("[KB: vHG4m5ptmJs]");
    expect(advice.sources).toEqual(["vHG4m5ptmJs", "imB5mYQHHi4"]);
  });

  it("flags invented stats in the AI transcript against retrieved KB", async () => {
    mockedKbSearch.mockResolvedValue({
      results: [{ source: "s1", text: "Our verified benchmark is a 27% reply rate.", score: 0.7 }],
      embedder: "local-hash-256",
    });

    const advice = await coachAdvise({
      objection,
      transcript: [
        { role: "model", text: "We deliver 3x ROI and a 27% reply rate." },
      ],
    });

    expect(advice.flaggedClaims.map((c) => c.raw)).toEqual(["3x"]);
  });

  it("falls back to empty script when the KB is unavailable", async () => {
    mockedKbSearch.mockRejectedValue(new Error("invoke failed"));
    const advice = await coachAdvise({ objection, transcript: [] });
    expect(advice.counterScript).toBe("");
    expect(advice.sources).toEqual([]);
  });

  it("asks the KB about the last prospect line when no objection is active", async () => {
    mockedKbSearch.mockResolvedValue({ results: [], embedder: "local-hash-256" });
    await coachAdvise({
      objection: null,
      transcript: [
        { role: "user", text: "How does this integrate with Salesforce?" },
      ],
    });
    expect(mockedKbSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining("Salesforce") })
    );
  });
});

describe("createDebouncedCoach", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires only once for a burst of transcript updates", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const coach = createDebouncedCoach(1000, fn);
    coach.schedule("a");
    coach.schedule("b");
    coach.schedule("c");
    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cancel prevents the pending call", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const coach = createDebouncedCoach(500, fn);
    coach.schedule("x");
    coach.cancel();
    await vi.advanceTimersByTimeAsync(600);
    expect(fn).not.toHaveBeenCalled();
  });
});
