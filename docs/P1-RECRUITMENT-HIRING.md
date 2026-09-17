# P1 — Recruitment Hiring vertical (schema v7 → v8)

**Status:** NOT started (iter-5+). Spec from Roman, 2026-09-17.  
**Code:** `G:\agency\opencloser-v2\project`  
**Do not mix with** existing `domain="recruitment"` (IT-recruiter **courses** / Academy). New domain: `recruitment_hiring`.

Increment to current codebase: new feature folder beside crm, voice, hunter, onboarding. Existing Recruitment Academy stays.

---

## 1. Domain model (migration v8)

One candidate may sit on many vacancies → pipeline is its own table, not a field on `candidates`.

### vacancies
`id, title, company, seniority, stack[] (JSON), salary_min, salary_max, currency, work_format, location, english_level, must_have[] (JSON), nice_to_have[] (JSON), hiring_manager, sla_days, status`

### candidates
`id, full_name, contacts (JSON), source, current_role, years_exp, stack[] (JSON), salary_expectation, notice_period, work_format_pref, english_level, dnc INTEGER, consent_recording INTEGER, consent_data_at TEXT`

### candidate_pipeline
`id, candidate_id, vacancy_id, stage, entered_at, owner, reject_reason`  
UNIQUE `(candidate_id, vacancy_id)`

### screening_sessions
`id, candidate_id, vacancy_id, steps_completed[] (JSON), talk_ratio, duration, guardrail_hits[] (JSON), transcript_ref`

### scorecards
`session_id PK, fit_role, motivation, comp_match, availability, communication, total, grade, notes`  
Criteria 0–3 each, max 15. Grade: A 13–15, B 10–12, C 6–9, D 0–5. Submitted only A/B.

### kb_chunks (already exists)
Keep table. Add nullable `vacancy_id TEXT`, `doc_type TEXT`.  
New hiring docs: `domain="recruitment_hiring"`, `doc_type` in `{vacancy_card, company_faq, comp_band, process}`.  
Index `(domain, vacancy_id)`. Existing course seed stays `domain="recruitment"` — do not mass-migrate.

Also bump `SCHEMA_VERSION` 7→8 in `src-tauri/src/db/schema.rs`. BASE_SCHEMA + `run_migrations` v7→v8 must stay consistent (same pattern as v6→v7).

---

## 2. Pipeline stages

| Stage | Enter | Exit |
|---|---|---|
| Intake | Vacancy created | must_have + salary fork + work_format filled, else block |
| Sourced | Candidate linked to vacancy | contact + source present |
| Contacted | First touch logged | reply or 3 attempts |
| Screening | Call scheduled | all required flow steps done |
| Scorecard | Call finished | scorecard filled, grade set |
| Submitted | Grade ≥ B | hiring-manager feedback |
| Interview | Slot confirmed | decision |
| Offer / Rejected / On hold | — | `reject_reason` required on Rejected |

Auto: stage idle > `sla_days` → highlight + task for owner.

`pipeline_move` must reject with a list of unmet exit criteria. DoD: cannot move to `submitted` without a filled scorecard.

---

## 3. Screening flow (hiring — not the sales/course flow)

Existing `src/features/copilot/screening-flow.ts` + `src/configs/screening-flow.ts` are **course-sales** recruiter coaching. Do **not** overwrite. New hiring flow lives in `src/features/recruitment/hiring/`.

| # | Step | Autofill | Blocker |
|---|---|---|---|
| 1 | Opening: intro + vacancy; recording consent; time confirm | `consent_recording` | |
| 2 | Current role: stack, team size, scope | `current_role, stack, years_exp` | |
| 3 | Change motivation | `motivation, push_factors` | |
| 4 | Vacancy fit: each must-have as its own question | `fit_must_have[]` | **hard** |
| 5 | Terms: salary, notice, format, location, English | `salary_expectation, notice_period, work_format_pref, english_level` | **hard** |
| 6 | Present vacancy from KB only (range, format, process, next steps) | `quoted_range` | |
| 7 | Candidate questions — Copilot answers from vacancy_card / company_faq with source | `candidate_questions[]` | |
| 8 | Risks: other processes, counteroffer | `competing_offers, counteroffer_risk` | |
| 9 | Next step: date + channel + what you will send | `next_step, next_step_date` | |

Skip 4 or 5 → scorecard must not compute.

---

## 4. Copilot in hiring mode

- KB sources: vacancy card, company FAQ, grade bands, process description.
- **Retrieval MUST filter `domain="recruitment_hiring"` AND `vacancy_id`.** This overrides the iter-4 sales decision that retrieval is cross-domain (`copilot.rs` comment). Sales/courses stay cross-domain; hiring does not. DoD: two similar vacancies, query «яка вилка» returns only the session vacancy.
- Hint format: ≤12-word answer → source + date → expandable context → next-best question.
- Persistent indicators: talk-ratio, current flow step, remaining unchecked must-haves.

Extend `copilot_turn` with `domain` + `vacancy_id`. When `domain="recruitment_hiring"`, vacancy_id is required.

Any number (range, stage count, SLA) shown only with KB source + updated-at. Missing → exact phrase: `Не маю точної інформації, уточню в хайринг-менеджера і напишу вам сьогодні`.

---

## 5. Guardrails (hard block, not a hint)

Forbidden questions: age, marital status, children, pregnancy, nationality, religion, health, orientation, political views. Hits → `guardrail_hits` + manager flag. DoD: contract test on transcript.

Forbidden promises: offer guarantee, interview-pass guarantee, named range above `salary_max`, decision timelines not in process KB.

Session must not start if `dnc=true` or no `consent_recording`. GDPR: cascade delete candidate across all hiring tables.

Reuse patterns in `src/features/copilot/screening-flow.ts` (FORBIDDEN_PATTERNS) — copy/adapt into hiring-core, do not break Academy tests.

---

## 6. Screens (`src/features/recruitment/hiring/`)

Keep Academy at `src/features/recruitment/components/RecruitmentKnowledgeView.tsx`.

| Screen | Role |
|---|---|
| VacancyIntake | 6-field wizard: role → must-have → range → format → process → SLA. Output: vacancy card ingested to KB |
| CandidateCard | Profile, touch history, pipelines, scorecards |
| ScreeningRoom | War Room extension: left = step rail + checkboxes; right = Copilot; top = talk-ratio + remaining must-haves |
| ScorecardForm | Auto-opens after call, prefilled from transcript; recruiter confirms |
| VacancyPipeline | Kanban by stage for one vacancy, SLA overdue highlight |
| RecruiterProgress | Newbie metrics + readiness gate |

Nav: new sidebar item **Hiring** (`hiring`), do not replace Academy.

---

## 7. New Tauri commands (additive; current handler has 15+ commands in `lib.rs`)

| Command | Behavior |
|---|---|
| `vacancy_create` | Create + validate required fields |
| `vacancy_publish_to_kb` | Render card → existing `kb_ingest_document` with `domain="recruitment_hiring"`, `doc_type="vacancy_card"`, `vacancy_id` |
| `candidate_upsert` | Upsert, dedupe by contact |
| `pipeline_move` | Stage change with exit-criteria check, else error listing unmet conditions |
| `screening_start` | DNC/consent gate, create session, return step plan for that vacancy |
| `screening_complete_step` | Mark step, write autofill fields |
| `screening_finish` | Close session, talk-ratio, draft scorecard |
| `scorecard_submit` | total + grade, move pipeline |
| `candidate_gdpr_delete` | Cascade delete |
| `copilot_turn` | extend: `domain`, `vacancy_id` |

Rust unit tests cannot live in the app crate (windows-gnu cdylib export ordinal limit — see `project/AGENTS.md`). Put pure logic in `src-tauri/crates/hiring-core` (same pattern as `kb-core`). Gate: `cargo +stable-x86_64-pc-windows-gnu test -p hiring-core` + `cargo check` on app.

---

## 8. Readiness gate + metrics

Live calls only after: 10 simulations, mean score ≥70, zero promise-guardrail hits in last 5, one full 1–9 run with no skips. Until then: shadow mode.

Newbie metrics: mean screening score, talk-ratio, % calls with all must-haves checked, % with dated next step, grade accuracy vs HM decision, KB lookups during call. Manager autoflag: any `guardrail_hits` or talk-ratio >75%.

---

## 9. Iteration order

- **iter-5** — v8 migration, vacancies + candidates + pipeline, VacancyIntake, `vacancy_publish_to_kb`.
- **iter-6** — ScreeningRoom: step rail, blockers, autofill, talk-ratio.
- **iter-7** — Copilot `vacancy_id` filter + guardrails.
- **iter-8** — scorecard, grade, VacancyPipeline + SLA.
- **iter-9** — readiness gate, RecruiterProgress, manager view.

---

## 10. Definition of Done (acceptance tests)

1. `pipeline_move` to `submitted` without scorecard → error.
2. Age/marital question in transcript → row in `guardrail_hits`.
3. «яка вилка» returns range of the session vacancy only (two similar vacancies in KB).
4. `screening_start` fails when `dnc=true` or no recording consent.
5. Golden-set of 40 typical candidate questions with gold answers runs on CI when prompts or chunking change.

---

## Forbidden in this vertical

- Do not overwrite Academy / `domain="recruitment"` course seed.
- Do not touch dirty voice relay/adapters (`src-tauri/src/relay/mod.rs`, `src/features/voice/lib/adapters/*`) unless a hiring screen cannot compile without it.
- Do not commit `.env`, secrets, `node_modules`, `target`.
- Do not silently swap the implementor: this session’s instruction is **agy** as worker. GOAL.md still names Union Alpha — honor the later Roman override (agy).
- No Docker. No live Gemini E2E without Roman’s keys.
- LinkedIn write automation is out of scope.
