# Production audit — OpenCloser v2

**Date:** 2026-09-15  
**Tree:** `G:\agency\opencloser-v2\project`  
**agy:** launched (`gemini-3.8-flash-high`, `--dangerously-skip-permissions`) then killed after ~7 min of ViewFile/GrepSearch with **zero file writes**. Remaining production slice implemented and verified in the parent session.

Production audit: **72/100**, launchable with caveats — internal demo / operator workstation only. Cap 84 because live provider E2E was not run and there is no Windows installer.

## One sentence

Claimed audit items 1–6/8/14 hold under independent commands; the app is still not customer-shippable without MSVC installer and live API smoke.

## Claimed-vs-actual

| Claim | Actual |
|---|---|
| 1. Demo/Live split | **Hold.** `simulate_lead_scraping` gone. `generate_demo_leads` in `gemini.rs` + frontend. README/LeadHunter say synthetic demo. |
| 2–3. Voice adapters | **Hold.** `src/features/voice/lib/adapters/{base,gemini,openai,elevenlabs,demo}.adapter.ts`. |
| 4. OS keychain | **Hold.** `src-tauri/src/secrets.rs` + `secure-keys.ts`. Prod `src/` has no API-key `localStorage.setItem`. `elevenlabs_agent_id` remains in localStorage (not a secret). |
| 5. AGY workspace | **Hold.** `OPEN_CLOSER_AGY_WORKSPACE` only under `cfg(debug_assertions)`; release uses `DEFAULT_WORKSPACE`; `canonicalize()`. |
| 6. DB v1–v5 | **Hold, then extended.** Unique `leads.phone`, indexes, `user_version`. This pass added **v6** DNC/consent/opt-out. |
| 8. Split + tests | **Hold.** KanbanBoard 401 lines, WarRoom 540. Independent `npm test`: **67/67** before this pass. |
| 14. npm audit | **Hold.** `npm audit` and `--omit=dev` both **0**. |

## What changed this pass

- `package.json` → `opencloser@0.1.0`; vite / `@vitejs/plugin-react` / dotenv moved to `devDependencies`.
- `.npmrc` `legacy-peer-deps=true` (CI `npm ci` arborist workaround).
- `release.yml` copy: “Demo Lead Generator (synthetic)”.
- Schema v6 + `set_lead_compliance` / `assert_lead_callable`; `add_call_log` refuses DNC.
- UI: DNC badge/toggles, Dial disabled, WarRoom + Power Dial skip DNC; live engine also requires consent.
- Tests: `src/test/compliance.test.ts` + Rust `db/compliance.rs` unit tests.

## Blockers (do not ship to customers)

- **MSVC + installer.** GNU target cannot produce a packaged desktop binary (`ld: export ordinal too large`). VS Build Tools install previously **1602** without admin UAC.
- **Live API E2E** against Gemini / OpenAI Realtime / ElevenLabs / Deepgram — never run.
- **No git repo** in this tree (no origin, no tags). Release workflow exists but cannot fire from here.
- **Code signing** absent.

## High-value fixes

- Install MSVC (admin) and produce NSIS/MSI via `npx tauri build`.
- One throwaway-key live voice session per provider.
- Init git + remote if this fork is the canonical tree.
- OS-level AGY sandbox (Job Object) — prompt/audit is not a security boundary.

## Evidence checked

- `npm run lint` → exit 0 (after change; package name `opencloser@0.1.0`).
- `npm test` → **71/71**, 10 files, 30s (was 67/9; +4 compliance tests).
- `npm run build` → exit 0, 21s, 1732 modules.
- `npm audit` / `--omit=dev` → 0 / 0 (pre-change; deps not added).
- Files: `secrets.rs`, `agy.rs`, `schema.rs` v6, adapters, README, CI, `package.json`, DNC UI/commands.
- `cargo test db::compliance` — compile started (`Compiling app v0.1.0`) then hit 180s timeout on this host. Tests exist in `src-tauri/src/db/compliance.rs`.

## Evidence missing

- Finished `cargo test` / clippy on GNU toolchain.
- Packaged `app.exe` from this tree.

## Next action

Install VS Build Tools with the C++ workload (admin UAC) and run `npx tauri build` on `x86_64-pc-windows-msvc`.
