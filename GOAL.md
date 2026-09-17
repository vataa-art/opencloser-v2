# GOAL — OpenCloser v2 cyclic improvement

**Date:** 2026-09-16  
**Owner:** Roman  
**Runtime:** Hermes Agent (Grok 4.6 supervisor) → OpenCode implementor → OpenCode tester  
**Guide:** `docs/HERMES_OPENCODE_GROK_UNION_ALPHA_SETUP.md`

## Goal

Циклічно довести **OpenCloser v2** (`G:\agency\opencloser-v2\project`) до внутрішнього green-стану з інтегрованим **Recruitment Academy**, не ламаючи demo-ready CRM/voice шар, і тримати цикл Grok 4.6 → Union Alpha → tester.

Це **не** customer release. Не Docker. Не live API без одноразових ключів від Roman.

## Roles

- Supervisor & Critic → Grok 4.6 (Hermes, цей оркестратор)
- Implementor → OpenCode `union-alpha` (якщо CLI/модель недоступні — чесно стоп, не підміняти іншим раннером мовчки)
- Tester → OpenCode free-модель (`big-pickle` / `muse-spark`, що підтвердить preflight)

## Acceptance criteria

1. Working-tree зміни або закомічені з повідомленням `iter-N: …`, або явно перелічені в `ITERATION_LOG.md` як незакомічені.
2. У `project/`: `npm run lint`, `npm test`, `npm run build` — green. Реальні лічильники з stdout, не з пам’яті.
3. Екран **Recruitment Academy** відкривається з сайдбару; каталог курсів синхронний з `knowledge/recruitment/courses.json`.
4. Файли циклу існують: `GOAL.md`, `WORKFLOW_STATE.md`, `ITERATION_LOG.md`, `.opencode/` агенти.
5. Архів working-tree лежить поза деревом проєкту, `testzip() is None`, без `.env` / `node_modules` / `target` / `.git` / `*.exe` / `*.db`.
6. Секрети не в git і не в архіві. Ключі лише OS keychain.

## Out of scope this cycle

- MSVC + MSI/NSIS installer (окремий admin UAC)
- Live Gemini / OpenAI Realtime / ElevenLabs / Deepgram E2E
- Windows code-sign
- LinkedIn write-автоматизація
- Пуш в upstream `issacops/opencloser-v2`

## Stop conditions

- Максимум 6 ітерацій кодування **або** усі acceptance 1–5 виконані.
- Явне «стоп» від Roman — негайно.
- OpenCode / Union Alpha недоступні — зафіксувати блокер у `WORKFLOW_STATE.md`, не підміняти AdaL/Codex мовчки.
