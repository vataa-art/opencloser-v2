# Handoff: opencloser-v2 sandbox

**Date:** 2026-08-28  
**Owner:** Roman  
**Status:** Internal green build (demo-ready). **Not** public release-ready.  
**Upstream:** https://github.com/issacops/opencloser-v2 (MIT)

---

## Where things live (all on G:)

| What | Path |
|------|------|
| **Working project (sandbox clone + patches)** | `G:\tools\_sandbox\opencloser-v2` |
| **Built desktop binary** | `G:\tools\_sandbox\opencloser-v2\src-tauri\target\release\app.exe` (~32 MB) |
| **Notes / this handoff twin** | `G:\tools\_sandbox\opencloser-NOTES.md` |
| **Install scripts / logs** | `G:\tools\_sandbox\` (`install-rust-g.ps1`, `install-winlibs-and-check.sh`, `*-console.log`, cargo logs) |
| **Rust toolchain** | `G:\tools\rustup` + `G:\tools\cargo` (rustc/cargo **1.98.0**) |
| **C linker used for build** | `G:\tools\mingw64\mingw64\bin` (WinLibs GCC **16.2** UCRT posix) |
| **Unused fallback** | `G:\tools\llvm-mingw` (failed: no libgcc) |
| **VS Build Tools target (failed)** | `G:\tools\vs-buildtools` — install exit **1602** (needs admin UAC) |

Upstream remote is still the public GitHub repo. **Local patches are not pushed.**

---

## What this project is

Open-source **Tauri 2 + React 19 + Rust** desktop “AI sales” app:
- Local SQLite CRM
- Gemini via Rust backend
- Voice relay (OpenAI Realtime / ElevenLabs) via local WS proxy
- Demo mode without API keys

Original marketing oversells “lead scraping” — backend mostly **generates** mock/Gemini leads, does not real-scrape.

---

## Verified state (do not trust claims — re-run if needed)

| Check | Result |
|-------|--------|
| `npm run lint` (`tsc --noEmit`) | **0** (after tsconfig exclude of `src-tauri`) |
| `npm test` (Vitest) | **35/35** |
| `npm run build` (Vite) | OK |
| `npm audit` | **1 low** — esbuild GHSA-g7r4-m6w7-qqqr (dev server file read on Windows) |
| `cargo check` (gnu + winlibs) | OK (2 warnings in `gemini.rs`) |
| `npx tauri build --no-bundle` | **OK** → `app.exe` |
| GUI smoke | Process starts, window title **OpenCloser**, Responding=True |
| Live API E2E (Gemini/OpenAI/ElevenLabs) | **Not done** |
| MSI/NSIS installer | **Not built** (`--no-bundle` only) |
| MSVC official toolchain | **Missing** |

### Shell env for rebuilds
```bat
set RUSTUP_HOME=G:\tools\rustup
set CARGO_HOME=G:\tools\cargo
set PATH=G:\tools\cargo\bin;G:\tools\mingw64\mingw64\bin;%PATH%
rustup default stable-x86_64-pc-windows-gnu
cd /d G:\tools\_sandbox\opencloser-v2
```

Git-bash note: call cargo as `G:/tools/cargo/bin/cargo.exe` if PATH is wrong; MSYS `link.exe` is **not** MSVC linker.

---

## Local patches already applied (sandbox only)

1. **`src-tauri/src/relay/mod.rs`**
   - OpenAI Realtime: `Authorization: Bearer {key}` + `OpenAI-Beta: realtime=v1` via `IntoClientRequest`
   - ElevenLabs: `xi-api-key` header (body key kept for compatibility)
   - Forwards **text** frames client↔provider (not only binary)
2. **`src-tauri/tauri.conf.json`**
   - CSP was `null` → restrictive CSP with connect-src allowlist (self/ipc + Gemini/OpenAI/ElevenLabs + local WS)
3. **`src-tauri/capabilities/default.json`**
   - Added `shell:allow-open` (app uses `@tauri-apps/plugin-shell` for VB-Cable/BlackHole/`tel:`)
4. **`tsconfig.json`**
   - `exclude: ["node_modules","dist","src-tauri"]` so `tsc` does not parse binary codegen assets under `target/`

---

## Security / quality backlog (priority order)

### P0 — before any real API keys / external users
1. **Do not store API keys in plain `localStorage`** — use OS keychain / Tauri secure store.
2. **Auth the local voice relay** (`127.0.0.1:0` WS currently accepts any local client with a key in first message).
3. **MSVC Build Tools (admin)** + rebuild with official `x86_64-pc-windows-msvc` + produce **MSI/NSIS** bundle.
4. Live smoke: one Gemini invoke + one OpenAI/ElevenLabs voice session with throwaway keys.

### P1 — release hygiene
5. Pin/fix **esbuild** low vuln (`npm audit` still reports it after `npm audit fix`).
6. Move `vite` / `@vitejs/plugin-react` from `dependencies` → `devDependencies` if still misplaced.
7. Rename package from `react-example`; clean `.env.example` AI Studio leftovers.
8. Fix rust warnings: unused `icp`, `isComplete` → snake_case in `src-tauri/src/ai/gemini.rs`.
9. Honest README: mock lead generation ≠ scraping.

### P2 — product
10. Code-sign Windows binary.
11. WebView2 bootstrap check on clean machines.
12. CSP may need tuning once real asset/CDN URLs appear — verify UI under CSP (already set, smoke was OK).

---

## Known non-goals / facts for next agent

- **Memory rule:** installs/sandbox stay on **G:** (not C: clutter).
- User language: **Ukrainian**, verify with real commands/artifacts, no fake green.
- Dual UI preference elsewhere is Linear/Raycast dark for userbot — OpenCloser has its own UI; don’t restyle unless asked.
- Upstream is early (few stars/commits); treat as **fork-and-harden**, not drop-in SaaS.
- First winlibs download attempt 404’d; working zip was:
  `https://github.com/brechtsanders/winlibs_mingw/releases/download/16.2.0posix-14.0.0-ucrt-r1/winlibs-x86_64-posix-seh-gcc-16.2.0-mingw-w64ucrt-14.0.0-r1.zip`

---

## Suggested next commands for incoming agent

```bat
cd /d G:\tools\_sandbox\opencloser-v2
set RUSTUP_HOME=G:\tools\rustup
set CARGO_HOME=G:\tools\cargo
set PATH=G:\tools\cargo\bin;G:\tools\mingw64\mingw64\bin;%PATH%

npm run lint && npm test && npm run build
npm audit

:: optional rebuild
npx tauri build --no-bundle
:: or with admin MSVC later: full bundle
```

Smoke binary:
```
G:\tools\_sandbox\opencloser-v2\src-tauri\target\release\app.exe
```

---

## One-line status

**Sandbox clone at `G:\tools\_sandbox\opencloser-v2` builds and runs OpenCloser (`app.exe`); security patches for relay+CSP applied locally; not shippable to customers until MSVC installer, secure key storage, relay auth, and live API smoke are done.**

---

## 2026-09-14: audit remediation (frontend honesty + relay/AGY hardening)

Verified on `G:\agency\opencloser-v2\project` (not the sandbox clone):

- **Frontend honesty:** Lead Hunter renamed to **Demo Lead Generator** with a
  SYNTHETIC badge; "Bypassing anti-bot defenses" wording removed; toasts and
  result badges say synthetic/demo. Onboarding, LeadHunter and PostCallDebrief
  now go through `src/services/ai.service.ts` / `onboarding.service.ts`, so the
  Gemini key from Settings actually reaches these flows. PostCallDebrief demo
  fallback is labelled `[Demo fallback — AI analysis unavailable]`.
- **CSP:** external `ui-avatars.com` avatars replaced with local initials divs
  (AppShell, KanbanBoard) — they were blocked by CSP in packaged builds.
- **Relay hardening (`src-tauri/src/relay/mod.rs`):** per-launch random token
  required in the first config message (`get_relay_token` command; OpenAI /
  ElevenLabs / Deepgram clients send it); `ready` is now sent only after the
  provider session is confirmed (OpenAI `session.created`, ElevenLabs
  `conversation_initiation_metadata`, Deepgram first frame; 15 s timeout);
  OpenAI Realtime events are translated (`input_audio_buffer.append` wrapping,
  `response.audio.delta` → binary PCM, transcript events → `transcript.model`
  / `transcript.user`, `speech_started` → `interrupted`); ElevenLabs ConvAI
  events translated (audio / interruption / agent_response / user_transcript);
  Deepgram final `Results` → `transcript.user`. Removed the misuse of
  `first_message: system_prompt` in the ElevenLabs handshake.
- **AGY bridge hardening (`src-tauri/src/agy.rs`):** concurrency cap (2),
  per-job wall-clock timeout (25 min) with kill, new `cancel_agy_agent`
  command, audit log (`.agy-audit.jsonl` in the workspace + `agy_audit` log
  target), owned paths are passed inside the agent prompt. NOTE: OS-level
  filesystem sandboxing of the child is still NOT implemented — the prompt and
  audit are mitigation, not a security boundary.
- **Dependencies:** browserslist (high) and baseline-browser-mapping
  (moderate) fixed via lockfile update; residual esbuild advisory is low and
  dev-only. README updated (39 tests / 4 suites, honest privacy + demo claims).

### Working local Rust toolchain (GNU target)

```bat
set RUSTUP_HOME=G:\tools\rustup
set CARGO_HOME=G:\tools\cargo
set PATH=G:\tools\winlibs\mingw64\bin;G:\tools\cargo\bin;%PATH%
```

- WinLibs mingw-w64 16.2 installed at `G:\tools\winlibs\mingw64` (provides
  `as.exe` needed by the self-contained `dlltool.exe` and `gcc.exe` for cc-rs).
- `cargo fmt`, `cargo check`, `cargo clippy`, `cargo test --lib --no-run` all
  pass. Run produced test exes with winlibs OUT of PATH (bundled rust-mingw
  libgcc/libwinpthread must win, otherwise STATUS_ENTRYPOINT_NOT_FOUND), and
  `WebView2Loader.dll` copied next to the test exe.
- **Known GNU limitation (proven, not a code bug):** linking the Tauri cdylib
  fails with `ld: export ordinal too large: 128237` — MinGW ld cannot export
  >65k symbols. Production desktop builds require the MSVC toolchain
  (`rustup default stable-x86_64-pc-windows-msvc` + VS Build Tools with the
  C++ workload), which is still not installed.

### Still open

- Live API E2E (Gemini / OpenAI Realtime / ElevenLabs / Deepgram audio) —
  protocol adapters are in place but never exercised against real services.
- MSVC toolchain + Windows installer (MSI/NSIS) + desktop smoke in CI.
  GNU ld cannot export >65k symbols (`export ordinal too large`); admin UAC
  for VS Build Tools previously failed with exit 1602.
- Code signing.

Closed 2026-09-15 (independent verify + remaining production slice):
- Secrets in localStorage → OS keychain (`secrets.rs` + `secure-keys.ts`).
- DB migrations/indices/unique phone; schema now **v6** with DNC / consent / opt-out.
- KanbanBoard / WarRoom split.
- Package identity: `opencloser@0.1.0` (was `react-example@0.0.0`); vite/plugin-react/dotenv are devDependencies; `.npmrc` has `legacy-peer-deps=true`.
- Dialer compliance gate: `assert_lead_callable` + UI DNC/consent toggles.
