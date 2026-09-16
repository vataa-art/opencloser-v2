---
name: tauri-desktop-security
description: Tauri 2 security hardening — CSP, capabilities, secure storage, local WS relay auth. Use for desktop security work.
---

# Tauri 2 desktop security (OpenCloser)

## Hard rules
1. Never leave `"csp": null` — keep allowlist CSP; extend connect-src only when a real endpoint is required.
2. Capabilities least-privilege: only grant what the UI actually invokes (`shell:allow-open` already needed for tel:/VB-Cable).
3. **API keys must not live in plain `localStorage`.** Prefer OS keychain / encrypted store (e.g. `keyring` crate, or strong OS-backed store via Tauri plugin). If interim: encrypt-at-rest with machine-bound key, never plaintext JSON in localStorage.
4. Local voice relay (`127.0.0.1`) must authenticate the frontend (session token / HMAC / one-time ticket from Rust). Do not accept raw provider API keys from any local process without binding to the app session.
5. Relay must keep Authorization headers (OpenAI Bearer + OpenAI-Beta; ElevenLabs xi-api-key) — already patched; do not regress.
6. No broad `shell:allow-execute` unless strictly required and scoped.
7. After capability/CSP changes: `npm run lint && npm test && npm run build`; if Rust touched: cargo check with gnu env.

## Audit hotspots in this repo
- `src-tauri/src/relay/mod.rs` — WS proxy
- `src-tauri/tauri.conf.json` — CSP / windows
- `src-tauri/capabilities/*.json`
- Frontend settings / stores that touch API keys (`SettingsView`, onboarding, localStorage)
- `caller-engine.ts` — voice WebSocket client

## Verification checklist
- [ ] Keys not readable as plaintext from DevTools Application→Local Storage after save
- [ ] Foreign WS client without app token cannot start relay session
- [ ] CSP does not break UI (app window loads)
- [ ] No secrets in logs or HANDOFF updates
