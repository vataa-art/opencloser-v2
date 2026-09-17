import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import {
  vacancyCreate,
  vacancyPublishToKb,
  candidateUpsert,
  pipelineMove,
  isHiringError,
  type CandidateInput,
  type VacancyInput,
} from "../services/hiring";

const mockedInvoke = vi.mocked(invoke);

const vacancyPayload: VacancyInput = {
  title: "Senior Frontend Engineer",
  company: "Acme Corp",
  seniority: "senior",
  salary_min: 5000,
  salary_max: 8000,
  currency: "USD",
  work_format: "remote",
  location: "Kyiv",
  english_level: "c1",
  must_have: ["3+ years React", "TypeScript strict"],
  nice_to_have: ["Design systems"],
  hiring_manager: "Jane Doe",
  sla_days: 14,
};

const candidatePayload: CandidateInput = {
  full_name: "John Candidate",
  contacts: [
    { kind: "email", value: "john@example.com" },
    { kind: "telegram", value: "@johnc" },
  ],
  source: "linkedin",
  current_role: "Frontend Engineer",
  years_exp: 5,
  stack: ["React", "TypeScript"],
  salary_expectation: "7000 USD",
  notice_period: "2 weeks",
  work_format_pref: "remote",
  english_level: "b2",
  dnc: false,
  consent_recording: true,
};

describe("hiring.service", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("vacancyCreate invokes vacancy_create with { payload }", async () => {
    mockedInvoke.mockResolvedValue({
      ...vacancyPayload,
      id: "vac-1",
      status: "intake",
    });

    const res = await vacancyCreate(vacancyPayload);

    expect(mockedInvoke).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("vacancy_create", { payload: vacancyPayload });
    expect(res.id).toBe("vac-1");
    expect(res.status).toBe("intake");
  });

  it("vacancyPublishToKb invokes vacancy_publish_to_kb with { vacancyId }", async () => {
    mockedInvoke.mockResolvedValue({ chunks: 4, embedder: "local-hash-256" });

    const res = await vacancyPublishToKb("vac-1");

    expect(mockedInvoke).toHaveBeenCalledWith("vacancy_publish_to_kb", { vacancyId: "vac-1" });
    expect(res.chunks).toBe(4);
    expect(res.embedder).toBe("local-hash-256");
  });

  it("candidateUpsert invokes candidate_upsert with { payload }", async () => {
    mockedInvoke.mockResolvedValue({ id: "cand-1", deduped: false });

    const res = await candidateUpsert(candidatePayload);

    expect(mockedInvoke).toHaveBeenCalledWith("candidate_upsert", { payload: candidatePayload });
    expect(res.id).toBe("cand-1");
    expect(res.deduped).toBe(false);
  });

  it("pipelineMove invokes pipeline_move with { candidateId, vacancyId, toStage }", async () => {
    mockedInvoke.mockResolvedValue({
      candidate_id: "cand-1",
      vacancy_id: "vac-1",
      stage: "screening",
    });

    const res = await pipelineMove("cand-1", "vac-1", "screening");

    expect(mockedInvoke).toHaveBeenCalledWith("pipeline_move", {
      candidateId: "cand-1",
      vacancyId: "vac-1",
      toStage: "screening",
    });
    expect(res.stage).toBe("screening");
  });

  it("surfaces a rejected HiringError object from invoke", async () => {
    const rejection = {
      code: "VALIDATION_FAILED",
      missing: ["hiring_manager", "must_have"],
      message: "Vacancy is missing required fields",
    };
    mockedInvoke.mockRejectedValue(rejection);

    await expect(vacancyCreate(vacancyPayload)).rejects.toBe(rejection);

    let caught: unknown;
    try {
      await vacancyPublishToKb("vac-1");
    } catch (e) {
      caught = e;
    }

    expect(isHiringError(caught)).toBe(true);
    if (isHiringError(caught)) {
      expect(caught.code).toBe("VALIDATION_FAILED");
      expect(caught.missing).toEqual(["hiring_manager", "must_have"]);
      expect(caught.message).toBe("Vacancy is missing required fields");
    }
  });

  it("isHiringError rejects non-HiringError values", () => {
    expect(isHiringError(new Error("boom"))).toBe(false);
    expect(isHiringError({ code: "X", missing: "not-an-array", message: "m" })).toBe(false);
    expect(isHiringError({ code: "X", missing: [], message: "m" })).toBe(true);
    expect(isHiringError(null)).toBe(false);
    expect(isHiringError("string")).toBe(false);
  });
});
