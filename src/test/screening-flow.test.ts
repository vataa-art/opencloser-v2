import { describe, it, expect } from "vitest";
import {
  SCREENING_FLOW,
  advanceStage,
  computeRedFlags,
  currentStage,
  detectForbiddenTopic,
  detectRecruitmentObjection,
  initialFlowProgress,
  nextBestQuestion,
  stageBlockersSatisfied,
  toggleQuestion,
} from "../features/copilot/screening-flow";
import { RECRUITMENT_ARCHETYPES } from "../configs/objection-archetypes-recruitment";

describe("screening flow — stage gating", () => {
  it("has 8 stages in the managed order", () => {
    expect(SCREENING_FLOW.stages).toHaveLength(8);
    expect(SCREENING_FLOW.stages.map((s) => s.id)).toEqual([
      "opening",
      "current_situation",
      "motivation_goal",
      "qualification",
      "course_match",
      "objections",
      "next_step",
      "post_call",
    ]);
  });

  it("does not let the recruiter advance until every blocker is checked", () => {
    const stage = currentStage(SCREENING_FLOW, initialFlowProgress);
    const partial = toggleQuestion(initialFlowProgress, stage.blocking_questions[0].id);
    expect(stageBlockersSatisfied(stage, partial.checked)).toBe(false);
    expect(advanceStage(SCREENING_FLOW, partial).currentStageIndex).toBe(0);
  });

  it("advances only when all blockers of the stage are checked", () => {
    const stage = currentStage(SCREENING_FLOW, initialFlowProgress);
    let progress = initialFlowProgress;
    for (const q of stage.blocking_questions) {
      progress = toggleQuestion(progress, q.id);
    }
    const advanced = advanceStage(SCREENING_FLOW, progress);
    expect(advanced.currentStageIndex).toBe(1);
    expect(advanced.completedStages).toContain("opening");
  });

  it("stops at the last stage (post_call)", () => {
    let progress = initialFlowProgress;
    // Walk the whole flow.
    for (let i = 0; i < SCREENING_FLOW.stages.length; i++) {
      const stage = currentStage(SCREENING_FLOW, progress);
      for (const q of stage.blocking_questions) progress = toggleQuestion(progress, q.id);
      progress = advanceStage(SCREENING_FLOW, progress);
    }
    expect(progress.currentStageIndex).toBe(SCREENING_FLOW.stages.length - 1);
    expect(progress.completedStages).toContain("post_call");
    // Further advance is a no-op.
    expect(advanceStage(SCREENING_FLOW, progress).currentStageIndex).toBe(
      SCREENING_FLOW.stages.length - 1
    );
  });
});

describe("next best question", () => {
  it("returns the first unchecked blocker of the current stage", () => {
    const nbq = nextBestQuestion(SCREENING_FLOW, initialFlowProgress);
    expect(nbq?.stageTitle).toBe("Відкриття");
    expect(nbq?.question.id).toBe("intro_school");
  });

  it("returns null when the stage is fully checked", () => {
    const stage = currentStage(SCREENING_FLOW, initialFlowProgress);
    let progress = initialFlowProgress;
    for (const q of stage.blocking_questions) progress = toggleQuestion(progress, q.id);
    expect(nextBestQuestion(SCREENING_FLOW, progress)).toBeNull();
  });
});

describe("forbidden topics — hard block", () => {
  it("detects each forbidden category", () => {
    expect(detectForbiddenTopic("Скільки вам років?")).toBe("вік");
    expect(detectForbiddenTopic("Ви одружені?")).toBe("сімейний стан");
    expect(detectForbiddenTopic("У вас є діти?")).toBe("діти");
    expect(detectForbiddenTopic("Ви вагітна?")).toBe("вагітність");
    expect(detectForbiddenTopic("Яка у вас національність?")).toBe("національність");
    expect(detectForbiddenTopic("До якої церкви ви ходите?")).toBe("релігія");
    expect(detectForbiddenTopic("Як ваше здоров'я?")).toBe("стан здоров'я");
    expect(detectForbiddenTopic("Які у вас політичні погляди?")).toBe("політичні погляди");
  });

  it("does not block normal screening questions", () => {
    expect(detectForbiddenTopic("Скільки годин на тиждень готові приділяти?")).toBeNull();
    expect(detectForbiddenTopic("Який бюджет розглядаєте?")).toBeNull();
  });
});

describe("red flags", () => {
  it("flags recruiter talking >65%", () => {
    const flags = computeRedFlags(SCREENING_FLOW, initialFlowProgress, {
      talkRatio: 0.7,
      quotedPrice: false,
      quotedStartDate: false,
      consentConfirmed: true,
    });
    expect(flags.map((f) => f.id)).toContain("talk_ratio_over_65");
  });

  it("flags a quoted price without a start date", () => {
    const flags = computeRedFlags(SCREENING_FLOW, initialFlowProgress, {
      talkRatio: 0.4,
      quotedPrice: true,
      quotedStartDate: false,
      consentConfirmed: true,
    });
    expect(flags.map((f) => f.id)).toContain("price_without_start_date");
  });

  it("stays quiet on a clean, complete call", () => {
    let progress = initialFlowProgress;
    for (const stage of SCREENING_FLOW.stages) {
      for (const q of stage.blocking_questions) progress = toggleQuestion(progress, q.id);
      progress = advanceStage(SCREENING_FLOW, progress);
    }
    const flags = computeRedFlags(SCREENING_FLOW, progress, {
      talkRatio: 0.4,
      quotedPrice: true,
      quotedStartDate: true,
      consentConfirmed: true,
    });
    expect(flags).toHaveLength(0);
  });
});

describe("recruitment objection archetypes", () => {
  it("detects «Дорого» with its core response", () => {
    const match = detectRecruitmentObjection("Це занадто дорого для мене");
    expect(match?.id).toBe("expensive");
    expect(match?.core_response).toContain("вартість місяця");
  });

  it("detects «Чи гарантуєте роботу?»", () => {
    const match = detectRecruitmentObjection("А ви гарантуєте роботу після курсу?");
    expect(match?.id).toBe("job_guarantee");
    expect(match?.core_response).toContain("Ніяких гарантій");
  });

  it("returns null for neutral text", () => {
    expect(detectRecruitmentObjection("Доброго дня, я залишив заявку")).toBeNull();
  });
});

describe("12 recruitment archetypes", () => {
  it("has 12 archetypes covering the full recruitment objection map", () => {
    expect(RECRUITMENT_ARCHETYPES).toHaveLength(12);
    const ids = RECRUITMENT_ARCHETYPES.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "expensive",
        "no_time",
        "job_guarantee",
        "let_me_think",
        "consult_family",
        "tried_failed",
        "competitor",
        "self_study",
        "too_old_no_base",
        "send_email",
        "wrong_moment",
        "distrust_online",
      ])
    );
    expect(new Set(ids).size).toBe(12);
  });

  it("detects «Пораджуся з дружиною»", () => {
    expect(detectRecruitmentObjection("Я пораджуся з дружиною")?.id).toBe("consult_family");
  });

  it("detects «Я вже пробував, не вийшло»", () => {
    expect(detectRecruitmentObjection("Я вже пробував, не вийшло")?.id).toBe("tried_failed");
  });

  it("detects «Не довіряю онлайн-школам»", () => {
    expect(detectRecruitmentObjection("Не довіряю я онлайн-школам")?.id).toBe("distrust_online");
  });

  it("detects «Надішліть матеріали на пошту»", () => {
    expect(detectRecruitmentObjection("Надішліть матеріали на пошту")?.id).toBe("send_email");
  });
});
