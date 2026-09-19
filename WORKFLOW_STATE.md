# WORKFLOW_STATE — OpenCloser v2

**Iteration:** audit-fix round 3 (Hoplite)  
**Updated:** 2026-09-18  
**Status:** iter-1..6 hiring/sales verticals committed; audit + production fixes done this round (see PRODUCTION_AUDIT.md)

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

## Plan for the next coding session

1. Hiring iter-6 (ScreeningRoom) з `docs/P1-RECRUITMENT-HIRING.md` §9 — або повернути transcripts-корпус у git (найменший хід, див. PRODUCTION_AUDIT.md).
2. Гейти незмінні: `npm run lint && npm test && npm run build`; Rust — `cargo test -p kb-core -p hiring-core` + `cargo check`.
3. Один writer на shared tree; Critic оцінює diff. FAIL → новий план. OK → commit.

## Parallelism rule

Один implementor на shared tree. Inventory/preflight — read-only. Tester не редагує src, лише тести/звіт, якщо не доручено інакше.

## Blockers

- Transcripts-корпус (`knowledge/recruitment/transcripts/`) існує лише на Windows-хості, не в git — KB сіється тільки курсами, acceptance-тест скіпається.
- Customer-release P0: MSVC installer, live API E2E, code signing — відкриті.
- `bin/OpenCloser.exe` (2026-08-28) не відповідає поточному дереву.

## Next decision for supervisor

Після preflight: або (а) запустити Union Alpha на iter-1, або (б) чесно сказати Roman що OpenCode/модель відсутні.
