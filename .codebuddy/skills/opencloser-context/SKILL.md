---
name: opencloser-context
description: OpenCloser v2 project map, verified state, patches, env. Load first on any opencloser task.
---

# OpenCloser v2 — project context

## Canonical paths
- **Work pack:** `G:\agency\opencloser-v2\`
- **Code root (cwd):** `G:\agency\opencloser-v2\project`
- **Binary:** `G:\agency\opencloser-v2\bin\OpenCloser.exe`
- **Handoff:** `G:\agency\opencloser-v2\docs\HANDOFF.md`
- Sandbox twin (older): `G:\tools\_sandbox\opencloser-v2`
- Upstream: https://github.com/issacops/opencloser-v2 (MIT) — local patches NOT pushed

## Stack
Tauri 2 + React 19 + Vite 6 + TypeScript strict + Rust backend + SQLite + Gemini + OpenAI Realtime / ElevenLabs voice relay.

## Already done (do not redo)
1. `src-tauri/src/relay/mod.rs` — OpenAI `Authorization: Bearer` + `OpenAI-Beta: realtime=v1`; ElevenLabs `xi-api-key` header; text frame forward
2. `src-tauri/tauri.conf.json` — CSP (was null)
3. `src-tauri/capabilities/default.json` — `shell:allow-open`
4. `tsconfig.json` — exclude `src-tauri` so tsc ignores target codegen binaries
5. npm audit fix → 1 low esbuild left; lint 0; tests 35/35; vite build OK; tauri build --no-bundle OK (gnu)

## Rebuild env (Windows)
```bat
set RUSTUP_HOME=G:\tools\rustup
set CARGO_HOME=G:\tools\cargo
set PATH=G:\tools\cargo\bin;G:\tools\mingw64\mingw64\bin;%PATH%
rustup default stable-x86_64-pc-windows-gnu
cd /d G:\agency\opencloser-v2\project
```
Call `cargo.exe` with Windows paths. MSYS `link.exe` is NOT MSVC linker.

## Owner rules
- Ukrainian replies to Roman if chatting; code/commits English
- Verify with real commands — no fake green
- Stay on G: for installs/artifacts
- Never print/commit secrets or API keys
- Do not claim customer-release until P0 closed
