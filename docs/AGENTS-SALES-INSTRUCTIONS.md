# Agent Instructions — OpenCloser Sales Core

**Date:** 2026-09-17
**From:** Antigravity / System
**To:** next coding agent
**Focus:** Sales is the core product; hiring parasitizes it. Do **not** start P1 hiring unless named.

---

## Workspace & Gates

- **Workspace:** `G:/agency/opencloser-v2/project`
- **Gates:** `npm run lint && npm test && npm run build` AND `cargo +stable-x86_64-pc-windows-gnu check` must be green.
- **No app-crate cargo test:** Rust tests go in `crates/*-core`. Do not run `cargo test` in the main app crate.

---

## Architecture & Rules

- **Copilot:** `copilot.rs` is a single writer. Sales retrieval stays cross-domain. Money/guarantee/timeline claims must *only* use KB source + date.
- **Objections:** Keep the 12 objection archetypes; the phrase-map is the fast layer.
- **Autonomy limits:** No auto-send. No auto-dial. No `status=Closed` without human confirm.
- **Academy:** Do not overwrite Academy course-sales modules.
- **Commits:** Voice/relay/adapters must **not** be in the same commit as CRM schema changes.

---

## Implementor Constraints

**Do:**
- New sales logic goes in testable modules (`kb-core` pattern).
- Phrase-detector stays.
- Sales copilot stays cross-domain (except money/guarantee/timeline).
- Follow-up = draft.
- Respect same npm/cargo gates.

**Don't:**
- Promise power dialer or autonomous hunter.
- Force `vacancy_id` on sales retrieval.
- Overwrite Academy scorecard.
- Auto-Closed.
- Send email/SMS/Stripe.
- Add Twilio «заодно» in a UI polish commit.
- Commit secrets.
- Explode `LeadStatus` to 15 without migration.
- Push `issacops/opencloser-v2`.

---

## P0→P1 Build Order

This is a checklist, not a "do all now" command.

- [x] 1. `STATUS.md` + honest README
- [x] 2. Consent/DNC + WarRoom start block
- [x] 3. Debrief schema: unanswered + next_step + talk_ratio (heuristic TS; no SQL v8 yet)
- [x] 4. Wire existing `kb_search` into WarRoom hint (price/guarantee/timeline gated)
- [x] 5. Confirm-writes on status/delete
- [x] 6. CSV import + kill «autonomous» Hunter label
- [x] 7. Fixture voice/transcript test
- [ ] 8. Then Twilio or budget cap + keychain

---

## Stop Conditions

Roman «стоп» → halt. Max one coding iteration per session unless he says continue. No push to `issacops/opencloser-v2`.

DONE_OK AGENTS-SALES-INSTRUCTIONS.md
