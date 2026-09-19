import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../stores/keys.store", () => ({ getProviderKey: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { getProviderKey } from "../stores/keys.store";
import { detectSimViolations } from "../features/copilot/sim-violations";

const mockedInvoke = vi.mocked(invoke);
const mockedGetKey = vi.mocked(getProviderKey);

const kbResult = (texts: string[]) =>
  texts.map((text) => ({ source: `src-${Math.random()}`, text, score: 0.5 }));

describe("detectSimViolations", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedGetKey.mockReset();
    mockedGetKey.mockResolvedValue("test-key");
  });

  it("flags a stat claim the KB does not back", async () => {
    mockedInvoke.mockResolvedValue({
      results: kbResult(["78% of graduates finish the program"]),
      embedder: "local-hash-256",
    });

    const verdict = await detectSimViolations([
      "Our program guarantees 90% of clients find a job in two weeks.",
    ]);

    expect(verdict.fabricatedStatViolation).toBe(true);
    expect(verdict.jobPromiseViolation).toBe(false);
  });

  it("does not flag a stat backed by a KB chunk", async () => {
    mockedInvoke.mockResolvedValue({
      results: kbResult(["The completion rate is 78% across cohorts."]),
      embedder: "local-hash-256",
    });

    const verdict = await detectSimViolations(["Our completion rate is 78%."]);

    expect(verdict.fabricatedStatViolation).toBe(false);
  });

  it("skips the KB when the rep made no stat claims", async () => {
    const verdict = await detectSimViolations(["I understand your concern, tell me more."]);

    expect(verdict.fabricatedStatViolation).toBe(false);
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("does not flag claims when the KB has no grounding chunks", async () => {
    mockedInvoke.mockResolvedValue({ results: [], embedder: "local-hash-256" });

    const verdict = await detectSimViolations(["We place 9 out of 10 candidates."]);

    expect(verdict.fabricatedStatViolation).toBe(false);
  });

  it("does not flag claims when the KB is unavailable", async () => {
    mockedInvoke.mockRejectedValue(new Error("no tauri"));

    const verdict = await detectSimViolations(["Our success rate is 95%."]);

    expect(verdict.fabricatedStatViolation).toBe(false);
  });

  it("detects a job-promise phrasing together with a fabricated stat", async () => {
    mockedInvoke.mockResolvedValue({
      results: kbResult(["Placement statistics vary per market."]),
      embedder: "local-hash-256",
    });

    const verdict = await detectSimViolations([
      "Ми гарантуємо роботу після курсу, наш рейтинг — 93%",
    ]);

    expect(verdict.jobPromiseViolation).toBe(true);
    expect(verdict.fabricatedStatViolation).toBe(true);
  });
});
