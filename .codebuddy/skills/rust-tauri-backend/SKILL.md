---
name: rust-tauri-backend
description: Rust/Tauri backend patterns for OpenCloser — relay, Gemini, SQLite. Use when editing src-tauri.
---

# Rust / Tauri backend (OpenCloser)

## Env
```bat
set RUSTUP_HOME=G:\tools\rustup
set CARGO_HOME=G:\tools\cargo
set PATH=G:\tools\cargo\bin;G:\tools\mingw64\mingw64\bin;%PATH%
rustup default stable-x86_64-pc-windows-gnu
cd src-tauri
cargo check
```
MSVC Build Tools not installed (UAC 1602). Prefer gnu toolchain unless user installs VS BT.

## Style
- Fix warnings when touching a file: unused vars (`icp`), `isComplete` → `is_complete` snake_case in `ai/gemini.rs`.
- Prefer `rustls-tls` (already) — do not switch to native-tls without reason.
- Relay: keep auth headers; add **app-side** auth before proxying.
- No `unsafe` unless unavoidable and commented.

## Build
```bat
npx tauri build --no-bundle
```
Full MSI needs MSVC + bundle config — out of scope until admin VS install.

## After Rust edits
1. `cargo check`
2. `npm test` (if TS bindings/commands changed)
3. Optional: rebuild `app.exe` and smoke-launch
