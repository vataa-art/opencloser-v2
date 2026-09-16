---
name: opencloser-p0-mission
description: Current P0 backlog for OpenCloser hardening. Use as the active mission checklist.
---

# P0 mission (do in order)

## 1. Secure API key storage
- Find all localStorage / plaintext key writes (Settings, onboarding, stores)
- Implement secure storage via Rust command + OS keyring or encrypted store
- Frontend save/load through Tauri commands only
- Migrate: on read, if old localStorage keys exist, import once then wipe plaintext

## 2. Voice relay app-auth
- Rust issues short-lived session token when app starts relay
- Frontend must present token on WS connect
- Reject unauthenticated local clients
- Keep existing provider Authorization headers

## 3. Hygiene if time
- Rename package `react-example` → something real (optional)
- Fix gemini.rs warnings
- Document honest lead-gen vs scrape in README snippet (optional)

## Out of scope this run
- MSVC install / MSI bundle (needs Roman admin UAC)
- Live paid API E2E without keys from Roman
- Force-breaking esbuild major bumps unless easy pin works

## Deliverable
- Code changes in `G:\agency\opencloser-v2\project`
- Short `docs/WORKLOG-P0.md` with commands run + results
- HANDOFF.md status section updated
