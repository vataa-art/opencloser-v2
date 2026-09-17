// Parity gate: the typed runtime configs in src/configs/ must stay in sync
// with the canonical content pack in knowledge/recruitment/. If this test
// fails, one side was edited without the other.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SCREENING_FLOW } from "../configs/screening-flow";
import { SCORECARD_BANDS, SCORECARD_CRITERIA } from "../configs/candidate-scorecard";
import { RECRUITMENT_ARCHETYPES } from "../configs/objection-archetypes-recruitment";
import { PRECALL_CHEATSHEET_FACTS } from "../configs/precall-cheatsheet";

// Canonical in-repo location (what GitHub gets).
const repoKnowledge = resolve(__dirname, "../../knowledge/recruitment");
// Pack-root drop location (user-maintained content pack; absent on GitHub).
const packKnowledge = resolve(__dirname, "../../../knowledge/recruitment");

function readJson(root: string, name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, name), "utf-8"));
}

describe("configs parity with knowledge/recruitment/", () => {
  it("screening-flow.ts matches screening-flow.json", () => {
    const canonical = readJson(repoKnowledge, "screening-flow.json");
    expect(SCREENING_FLOW.stages).toEqual(canonical.stages);
    expect(SCREENING_FLOW.red_flags).toEqual(canonical.red_flags);
    expect(SCREENING_FLOW.forbidden_topics).toEqual(canonical.forbidden_topics);
    expect(SCREENING_FLOW.version).toBe(canonical.version);
  });

  it("candidate-scorecard.ts matches candidate-scorecard.json", () => {
    const canonical = readJson(repoKnowledge, "candidate-scorecard.json") as {
      criteria: unknown;
      bands: unknown;
    };
    expect(SCORECARD_CRITERIA).toEqual(canonical.criteria);
    expect(SCORECARD_BANDS).toEqual(canonical.bands);
  });

  it("objection archetypes match objection-archetypes-recruitment.json", () => {
    const canonical = readJson(repoKnowledge, "objection-archetypes-recruitment.json") as {
      archetypes: unknown;
    };
    expect(RECRUITMENT_ARCHETYPES).toEqual(canonical.archetypes);
  });

  it("cheat sheet facts match precall-cheatsheet.json", () => {
    const canonical = readJson(repoKnowledge, "precall-cheatsheet.json") as { facts: unknown };
    expect(PRECALL_CHEATSHEET_FACTS).toEqual(canonical.facts);
  });
});

// The pack-root content pack is a local (non-git) drop location. When it
// exists, it must not drift from the repo copies.
describe.skipIf(!existsSync(packKnowledge))("pack-root content pack parity", () => {
  it("repo copies match knowledge/recruitment/ at the pack root", () => {
    for (const name of [
      "screening-flow.json",
      "candidate-scorecard.json",
      "objection-archetypes-recruitment.json",
      "precall-cheatsheet.json",
    ]) {
      expect(readJson(repoKnowledge, name)).toEqual(readJson(packKnowledge, name));
    }
  });
});
