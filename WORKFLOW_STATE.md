# WORKFLOW_STATE — OpenCloser v2

**Iteration:** 0 (pack + handoff + subagent bootstrap)  
**Updated:** 2026-09-16 23:10 EEST  
**Status:** packaging in progress; coding cycle not started

## Source identity

- Pack root: `G:\agency\opencloser-v2`
- Canonical code: `G:\agency\opencloser-v2\project`
- Git: `main` @ `66d018eb6786bb049aa223c97d32e164ec2ae44a` (`chore: baseline hardened OpenCloser v2`)
- Working tree: **DIRTY** — label archive as working-tree, not commit snapshot
- Pack-level git: none

## Dirty files (uncommitted)

Modified:

- `src-tauri/src/relay/mod.rs`
- `src/components/AppShell.tsx`
- `src/constants.ts`
- `src/features/crm/components/KanbanBoard.tsx`
- `src/features/crm/components/shell/AppSidebar.tsx`
- `src/features/voice/lib/adapters/base.ts`
- `src/features/voice/lib/adapters/gemini.adapter.ts`
- `src/features/voice/lib/adapters/openai.adapter.ts`
- `src/features/voice/lib/providers.ts`
- `src/stores/navigation.store.ts`
- `src/test/openai-adapter.test.ts`
- `src/test/pcm.test.ts`
- `src/test/providers.test.ts`

Untracked:

- `src/features/recruitment/` (`RecruitmentKnowledgeView.tsx` + Recruitment Academy nav)

## Plan for iteration 1 (after pack is verified)

1. Supervisor читає цей файл + `GOAL.md` + `HANDOFF.md`.
2. Preflight OpenCode: version, auth, exact model IDs (Union Alpha / Big Pickle / Grok 4.6). Якщо ID немає — стоп.
3. Implementor (Union Alpha) **один** owner на `project/`:
   - довести Recruitment Academy до компіляції/тестів;
   - не чіпати voice relay secrets;
   - не комітити `.env`.
4. Tester запускає `npm run lint && npm test && npm run build` у `project/` (venv isolation: `unset PYTHONPATH PYTHONHOME VIRTUAL_ENV` не потрібен для npm, але не запускати через Hermes python).
5. Critic (Grok 4.6) оцінює diff + тести. FAIL → новий план, iter+1. OK → commit `iter-N: …`.

## Parallelism rule

Один implementor на shared tree. Inventory/preflight — read-only. Tester не редагує src, лише тести/звіт, якщо не доручено інакше.

## Blockers

- OpenCode CLI (`opencode`) **не знайдений** на PATH під час bootstrap (`hermes` і `grok` є). Preflight-субагент перевіряє глибше. Поки CLI не підтверджений — implementor JSON є **draft**.
- `bin/OpenCloser.exe` (2026-08-28, 33.6 MB) **не** відповідає dirty tree 2026-09-16.
- Customer-release P0 (MSVC installer, live API E2E) лишаються відкритими — не в цій ітерації.

## Next decision for supervisor

Після preflight: або (а) запустити Union Alpha на iter-1, або (б) чесно сказати Roman що OpenCode/модель відсутні.
