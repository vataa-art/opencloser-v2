# ITERATION_LOG — OpenCloser v2

## iter-0 — 2026-09-16

**Actor:** Hermes / Grok 4.6 (supervisor)  
**Action:** working-tree pack + handoff за гайдом Hermes+OpenCode+Grok+Union Alpha; створення субагентів.

Зроблено:

- Скопійовано гайд у `docs/HERMES_OPENCODE_GROK_UNION_ALPHA_SETUP.md`
- Попередній audit-HANDOFF збережено як `docs/HANDOFF-audit-2026-09-16.md`
- Створено `GOAL.md`, `WORKFLOW_STATE.md`, цей лог
- Створено `.opencode/` agent definitions (draft until OpenCode CLI preflight)
- Spawn Hermes subagents: OpenCode preflight, working-tree inventory

Не зроблено (свідомо):

- `git commit` dirty tree
- запуск Union Alpha на код
- live API E2E
- включення `node_modules` / `target` / `OpenCloser.exe` в архів

## audit-fix round 3 — 2026-09-18 (Hoplite)

**Actor:** Hoplite (цей потік)  
**Action:** незалежний аудит недопрацювань + фікси production-readiness.

Зроблено:

- Аудит усіх гейтів з нуля: tsc 0, Vitest 163/1 skip, Vite build OK, npm audit 0/0, hiring-core 33/33, kb-core 14/14, cargo check app-crate зелений (Linux).
- Виправлено KB-сівинг: `seed_dir()` більше не прив'язаний до легасі pack-root шляху; courses.json сіється незалежно від transcripts.
- Виправлено acceptance-тест kb-core (repo-шлях + чесний SKIP без корпусу) — корпус транскриптів ніколи не був у git.
- Підключено реальне виявлення fabricated-stat порушень у симуляціях (`sim-violations.ts` + 6 тестів) — readiness-gate критерій «чисті останні 5» тепер працює.
- Додано кнопку «Зупинити worker» (cancel_agy_agent) в AgyTeamView.
- Видалено мертвий `ROUTES`-експорт; README чесно описує статус transcripts-паку.
- Новий звіт: `PRODUCTION_AUDIT.md` (76/100, internal demo / operator workstation).

Не зроблено (свідомо):

- повернення transcripts-корпусу в git (дані лише на Windows-хості);
- MSVC-інсталер, live API E2E, code signing;
- hiring iter-6..9 (ScreeningRoom, scorecard-команди, VacancyPipeline, RecruiterProgress).
