# Handoff — OpenCloser P1 Hiring (iter-5+)

**Date:** 2026-09-17 21:45 EEST  
**From:** Hermes / Grok 4.6 (supervisor only this turn)  
**To:** next coding agent  
**Focus:** implement P1 hiring vertical on OpenCloser. Do not re-audit iter-1..4. Do not launch customer-release.

Roman asked for a handoff plan, not execution. Do **not** start agy until he says «роби» / «запускай».

---

## Goal of next session

Ship **iter-5** of [P1-RECRUITMENT-HIRING.md](./P1-RECRUITMENT-HIRING.md): schema v7→v8 (`vacancies`, `candidates`, `candidate_pipeline` + `kb_chunks.vacancy_id/doc_type`), Tauri `vacancy_create` + `vacancy_publish_to_kb` + `candidate_upsert` + `pipeline_move` (Intake/Sourced gates), screen `VacancyIntake`, nav item **Hiring** without replacing Academy.

Success = real stdout: `npm run lint`, `npm test`, `npm run build` green; `cargo +stable-x86_64-pc-windows-gnu check` green; `cargo +stable-x86_64-pc-windows-gnu test -p hiring-core` (new crate) green. Then stop and wait — iter-6 is ScreeningRoom.

---

## State of play

**Done (committed, `main` @ `696b3a5`):**
- iter-1..4: KB schema v7, `kb-core`, `kb_ingest_document` / `kb_search`, CoachAgent, `copilot_turn`, Academy. Log: `G:/agency/opencloser-v2/ITERATION_LOG.md`.
- Gates at that commit: vitest 98/98, kb-core 15/15, tsc + vite build green. **Re-run after your edits.**

**Not started:**
- Entire P1 hiring spec. No `hiring-core`, no v8, no `src/features/recruitment/hiring/`.

**In progress / dirty (do not fold into hiring commits):**
- Pack: `G:/agency/opencloser-v2` (not a git repo). Canonical git: `G:/agency/opencloser-v2/project`, branch `main`, dirty vs origin.
- Untracked Academy + copilot extras: `src/features/recruitment/`, `src/configs/`, `src/features/copilot/{screening-flow,candidate-scorecard}.ts`, matching tests. These are **course-sales** coaching — keep, do not overwrite.
- Modified voice/adapters + `AppShell.tsx` + `CopilotPanel.tsx` + relay — leave alone.
- Workflow files untracked under `project/`: `GOAL.md`, `WORKFLOW_STATE.md`, `ITERATION_LOG.md` (canonical copies also at pack root).

**Blocking:**
- App-crate `cargo test` cannot run (windows-gnu cdylib ordinal >65535). Tests go in `crates/hiring-core` like `kb-core`. Details: `project/AGENTS.md`.
- MSVC/`link.exe` hijack if PATH has MSYS. Use gnu toolchain from AGENTS.md.
- `agy --print` default timeout 5m; long turns die ~12m. Use `--print-timeout 20m` + `--dangerously-skip-permissions` (or `G:/agency/bin/agy-ask`). Headless without that flag auto-denies all tools.
- GOAL.md names OpenCode Union Alpha as implementor; Roman later said **agy as subagents**. Honor agy. One writer on shared tree.

---

## Open decisions

1. **Retrieval exception:** iter-4 made sales `copilot_turn` cross-domain. P1 **requires** hiring retrieval filtered by `domain="recruitment_hiring"` AND `vacancy_id`. Do not “fix” sales to match hiring. Lean: branch inside `copilot_turn`.
2. **Existing `domain="recruitment"`:** keep as Academy/courses. Do not rename in-place. Lean: add `recruitment_hiring`.
3. **Dirty tree:** hiring work in new files + minimal nav (`constants.ts`, `navigation.store.ts`, `AppSidebar.tsx`, `KanbanBoard.tsx`). Do not commit voice/relay dirt in the same `iter-5:` commit.
4. **Implementor:** agy `gemini-3.1-pro-high` (catalog live 2026-09-17). Do not silently swap AdaL/Codex/Grok-as-coder. Show task text if using AdaL; agy already authorized by Roman for this workstream once he says go.
5. **Scorecard naming:** Academy scorecard (`motivation/time/budget/...`) ≠ hiring scorecard (`fit_role/motivation/comp_match/availability/communication`). Separate modules.

---

## Skills to use (next session)

- `antigravity-cli` — agy invoke (`--print='…'` attached to flag; `--print-timeout`; `--dangerously-skip-permissions`)
- `agent-task-verification` — agent stdout is a claim; verify files + gates yourself
- `external-cli-agent-orchestration` — one implementor, then independent verify
- `software-development/windows-terminal-paths` — MSYS bash; `unset PYTHONPATH`; no `env -u` (swallows stdout)
- `software-development/project-handoff-archives` — only if Roman asks for a zip
- `tdd-workflow` / `karpathy-coder` — hiring-core tests first; keep diffs small
- `meta/mandatory-skill-router` — re-route every turn

Do **not** use recruiter-orchestrator (that pack is GitHub sourcing under `~/recruiting/`, different product).

---

## Artifacts (reference only — do NOT duplicate)

- **This P1 spec:** `G:/agency/opencloser-v2/docs/P1-RECRUITMENT-HIRING.md`
- **This handoff (durable):** `G:/agency/opencloser-v2/docs/HANDOFF-P1-HIRING.md`
- **Temp copy:** `/tmp/handoff-3mJuwM.md`
- **Cycle files:** `G:/agency/opencloser-v2/{GOAL,WORKFLOW_STATE,ITERATION_LOG,HANDOFF}.md`
- **Agent guide / rust gates:** `G:/agency/opencloser-v2/project/AGENTS.md`
- **Audit (AGY timeout, wrong DEFAULT_WORKSPACE):** `G:/agency/opencloser-v2/docs/audit-opencloser-2026-09-17.md` — out of scope for iter-5 unless it blocks compile
- **HEAD:** `696b3a574c0b745d97a9ab3e5f200f4c1b041949`
- **Commands to register:** `project/src-tauri/src/lib.rs` `generate_handler!`
- **Schema to bump:** `project/src-tauri/src/db/schema.rs` (`SCHEMA_VERSION = 7`)
- **KB ingest to reuse:** `project/src-tauri/src/ai/kb.rs` `kb_ingest_document`
- **Copilot to extend:** `project/src-tauri/src/ai/copilot.rs`
- **Academy (leave):** `project/src/features/recruitment/components/RecruitmentKnowledgeView.tsx`
- **agy helper:** `G:/agency/bin/agy-ask`
- **agy binary:** `C:/Users/Roman/AppData/Local/agy/bin/agy.exe` (1.2.5)
- **Toolchain:** `G:/tools/{rustup,cargo,mingw64}`
- **Do not use as workspace:** `G:/tools/telegram-userbot` (agy.rs DEFAULT_WORKSPACE bug)

### First commands after pickup

```bash
cd "G:/agency/opencloser-v2/project"
git status -sb
git log -1 --oneline
# then implement iter-5 only from docs/P1-RECRUITMENT-HIRING.md §9
```

### Stop conditions

Roman «стоп» → halt. Max one coding iteration per session unless he says continue. No push to `issacops/opencloser-v2`.
