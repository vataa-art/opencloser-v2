# STATUS — OpenCloser sales (honest)

**Date:** 2026-09-17  
**Version:** 0.1.0  
**Code:** `G:/agency/opencloser-v2/project`

This is a **desktop sales workbench**, not an autonomous SDR team.

## Live ≠ local

- **CRM** (leads, notes, call logs) is SQLite on disk.
- **Live mode** sends prompts, transcripts, and audio to the providers you configure (Gemini / OpenAI / ElevenLabs / Deepgram).
- **Demo mode** (no keys) stays offline with synthetic leads and mock replies.

## What works today

- Kanban CRM (4 statuses: Discovery / Outbound Call / Audit Requested / Closed)
- WarRoom via virtual audio cable (VB-Cable / BlackHole) — not PSTN
- Objection trainer (12 archetypes; live detector is phrase `includes`)
- Local KB + `copilot_turn`
- Post-call debrief (LLM if keyed; heuristic talk-ratio / open objections always)
- DNC always blocks dial; **live** also requires `consent_at`

## Do not tell a founder

- Autonomous hunter (command is `generate_demo_leads`)
- Native power dialer / parallel lines / AMD
- “No cloud” for real calls
- Auto-send email/SMS or auto-`Closed`

Full claim table: `docs/STATUS-SALES.md`. Agent law: `docs/AGENTS-SALES-INSTRUCTIONS.md`.
