import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RECRUITMENT_COURSES } from "../features/recruitment/components/RecruitmentKnowledgeView";

// Review-agy F2 guard: the view must mirror the canonical manifest at
// knowledge/recruitment/courses.json (single source of truth). UI-only
// fields (duration_hint, topics wording, risk) are intentionally not
// compared. external_catalog entries are metadata-only per provider
// ToS and are rendered by a separate view, not this one.
const manifestPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../knowledge/recruitment/courses.json",
);

interface ManifestCourse {
  id: string;
  kind: string;
  title?: unknown;
  url?: unknown;
  lessons?: unknown;
  coverage?: unknown;
  verified_alive?: unknown;
  transcript_likelihood?: unknown;
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { courses: ManifestCourse[] };
const byId = new Map(manifest.courses.map((c) => [c.id, c]));

describe("recruitment courses sync with knowledge manifest", () => {
  it("renders only courses that exist in the manifest, with matching identity fields", () => {
    expect(RECRUITMENT_COURSES.length).toBeGreaterThan(0);
    for (const course of RECRUITMENT_COURSES) {
      const src = byId.get(course.id);
      expect(src, `course "${course.id}" missing from courses.json`).toBeDefined();
      expect(src?.title).toBe(course.title);
      expect(src?.url).toBe(course.url);
      expect(src?.kind).toBe(course.kind);
      expect(src?.lessons ?? null).toBe(course.lessons);
      expect(src?.verified_alive).toBe(course.verified_alive);
      expect(src?.transcript_likelihood).toBe(course.transcript_likelihood);
      expect([...((src?.coverage as string[]) ?? [])].sort()).toEqual([...course.coverage].sort());
    }
  });

  it("hides no free YouTube course from the manifest", () => {
    const feIds = new Set(RECRUITMENT_COURSES.map((c) => c.id));
    const hidden = manifest.courses
      .filter((c) => c.kind === "playlist" || c.kind === "video")
      .filter((c) => !feIds.has(c.id))
      .map((c) => c.id);
    expect(hidden).toEqual([]);
  });
});
