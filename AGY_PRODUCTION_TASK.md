# TASK: Verify claimed audit work, then finish remaining production items

You are an independent coding agent. Do not trust prior agent reports. Treat every claim as unverified until you produce command output.

Workspace: `G:/agency/opencloser-v2/project`
Language of the final report: Ukrainian.
Do not push, do not git init, do not install MSVC, do not call live Gemini/OpenAI/ElevenLabs/Deepgram APIs, do not read or print any API keys.

Write a report to `G:/agency/opencloser-v2/project/PRODUCTION_AUDIT.md` when done. Last line of stdout MUST be exactly:
`AGY_PRODUCTION_DONE`

## Part A — Verify claimed work (evidence, not narrative)

Confirm or refute each claim with file paths + command output:

1. Demo/Live split: `simulate_lead_scraping` gone; `generate_demo_leads` exists; README/UI say synthetic demo, not scraping.
2. Voice adapters under `src/features/voice/lib/adapters/` (gemini, openai, elevenlabs, demo, base) and `caller-engine.ts` is a thin gateway.
3. OS keychain: `src-tauri/src/secrets.rs` + frontend `secure-keys.ts` / `keys.store.ts`. Grep production `src/` (exclude `src/test`) for leftover API-key writes to localStorage.
4. AGY: env override `OPEN_CLOSER_AGY_WORKSPACE` only in debug; release uses `DEFAULT_WORKSPACE`; path is canonicalize()'d.
5. DB: `PRAGMA user_version` v1–v5, unique index on `leads.phone`, indexes exist.
6. KanbanBoard / WarRoom split into shell + warroom modules.
7. Tests: run `npm test` and `npm run lint` yourself. Record actual counts.
8. `npm audit` and `npm audit --omit=dev`. Record actual numbers.

Use a clean environment (do not inherit Hermes PYTHONPATH). On this Windows host, `unset PYTHONPATH PYTHONHOME VIRTUAL_ENV` before npm/python.

## Part B — Remaining production work (implement)

These are still open from HANDOFF.md and a live tree inspection. Implement them.

### B1. Package identity (P1)
- `package.json` is still `"name": "react-example"`, `"version": "0.0.0"`. Change to `"name": "opencloser"`, `"version": "0.1.0"` to match `src-tauri/tauri.conf.json`.
- Move `vite`, `@vitejs/plugin-react`, and `dotenv` out of `dependencies` into `devDependencies` only (vite is currently duplicated in both). Do not leave duplicates.

### B2. CI npm arborist workaround
- Add `.npmrc` with `legacy-peer-deps=true` so `npm ci` in `.github/workflows/ci.yml` and `release.yml` does not hit npm 10.9 arborist peer bugs.
- Do not rewrite the whole CI. Keep rust-check and tauri-build jobs.

### B3. Honest release copy
- `.github/workflows/release.yml` still markets “lead researcher”. Change that sentence to honest “Demo Lead Generator (synthetic)” wording. Do not invent features.

### B4. Compliance layer: DNC / opt-out / consent (P2 product, production-blocking for a dialer)
Add a real, local, test-covered compliance gate. Keep it small.

Schema v6 (`src-tauri/src/db/schema.rs`):
- `leads.dnc INTEGER NOT NULL DEFAULT 0`
- `leads.consent_at TEXT DEFAULT NULL`  (ISO timestamp or empty)
- `leads.opted_out_at TEXT DEFAULT NULL`
Bump `SCHEMA_VERSION` to 6. Migration v5→v6 uses the existing `safe_alter` pattern.

Rust commands (`src-tauri/src/db/commands.rs` + register in `lib.rs`):
- `set_lead_compliance(id, dnc: bool, consent: bool)` — sets flags + timestamps.
- `start_call` / any command that initiates a voice session MUST refuse with a clear error if `dnc != 0` or `opted_out_at` is set.
- If there is no dedicated start_call command, add `assert_lead_callable(id)` and call it from the frontend WarRoom / Kanban “Call” path before connecting an engine.

Frontend:
- Lead detail: DNC badge + toggle “Do not call” and “Consent recorded”.
- Call button disabled when DNC/opt-out.
- Demo leads from generator default to `dnc=0` and no consent (honest: operator must record consent before a live provider call; demo engine may still run).

Tests:
- Rust unit test: callable vs DNC lead.
- Vitest: UI/store refuses to start a live engine for a DNC lead.

### B5. HANDOFF.md
Rewrite the “Still open” section to match reality AFTER your changes. Keep honest blockers:
- MSVC toolchain + Windows installer: NOT done (admin UAC previously failed with 1602). Do not attempt.
- Live API E2E against real providers: NOT done. Do not attempt.
- Code signing: NOT done.

## Part C — Verification you must re-run after edits

```
unset PYTHONPATH PYTHONHOME VIRTUAL_ENV
npm run lint
npm test
npm run build
npm audit
npm audit --omit=dev
```

If `npm ci` is needed, use the project’s existing node_modules; do not delete node_modules.

Do not run `npx tauri build` (GNU ld export-ordinal limit is a known blocker). Cargo fmt/clippy/test are optional if the GNU toolchain is on PATH (`RUSTUP_HOME=G:/tools/rustup`, `CARGO_HOME=G:/tools/cargo`, `PATH` includes `G:/tools/cargo/bin` and `G:/tools/winlibs/mingw64/bin` or `G:/tools/mingw64/mingw64/bin`).

## Report format (`PRODUCTION_AUDIT.md`)

```
Production audit: <score>/100, <band>, <one-sentence why>
Blockers: ...
High-value fixes: ...
Evidence checked: commands + files
Evidence missing: ...
Claimed-vs-actual: table of the 8 claims
What I changed: file list
Next action: one concrete step
```

Score caps from the production-audit skill:
- Cap 69 if secrets leak, auth missing on sensitive data, or migrations cannot run.
- Cap 84 if CI is not green or launch-critical path was not E2E tested.

Do not claim production-ready if MSVC installer and live E2E are still missing — call it “internal demo / launchable with caveats” at best.
