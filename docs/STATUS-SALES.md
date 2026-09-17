# OpenCloser Sales Feature Status

## Honest Product Status
OpenCloser provides a highly functional, local-first React and Tauri desktop CRM and AI "war room", but its marketing claims outpace its reality. When run in "Live" mode, the product is absolutely dependent on cloud services (Gemini, OpenAI, ElevenLabs, Deepgram) to function, making claims of "zero cloud dependency" and "data never leaves" inaccurate unless constrained strictly to demo mode. It is not an autonomous AI workforce; it is a human-in-the-loop desktop app that requires manual clicks, utilizes virtual audio cables instead of native telephony integrations, and relies on LLMs for post-call analysis while using simple string-matching for live objection detection.

## Claims Verification Table

| Claim from Research | Verdict | Source File Path |
| :--- | :--- | :--- |
| Tauri commands listed (`simulate_lead_scraping`, etc.) | **PARTIAL** | `src-tauri/src/lib.rs` (Most exist, but `simulate_lead_scraping` is actually named `generate_demo_leads`) |
| Narrow LeadStatus / Lead types (No MEDDPICC, etc.) | **TRUE** | `src/types.ts` |
| `simulate_lead_scraping` existence / simulates scraping | **FALSE** | `src/services/ai.service.ts` (Command is explicitly named `generate_demo_leads`; `simulate_lead_scraping` doesn't exist) |
| `detectObjection` is a basic string `includes` gym hint on last 3 user lines | **TRUE** | `src/features/voice/lib/objection-engine.ts` |
| Keys in keychain vs localStorage | **PARTIAL** | `src/services/secure-keys.ts` & `src/features/crm/components/SettingsView.tsx` (API keys are in keychain, but `elevenlabs_agent_id` remains in `localStorage`) |
| Schema has `dnc`/`consent_recording` columns (v6+) | **TRUE** | `src-tauri/src/db/schema.rs` (`dnc`, `consent_at`, `opted_out_at` added in v6 migration) |
| README phrases: no cloud, power dial, autonomous, 35 tests | **PARTIAL** | `README.md` (README claims "zero cloud", "power dialing", but lists 67 tests instead of 35) |
| package.json version is 0.0.0 | **FALSE** | `package.json` (Version is currently `0.1.0`) |
| `copilot_turn` / `kb_search` present locally | **TRUE** | `src-tauri/src/lib.rs` |

## Founder Capabilities: Reality Check

**What a founder CAN use today:**
* A lightweight desktop CRM with SQLite backend for manual pipeline management.
* Voice AI (via OpenAI/Gemini/ElevenLabs) connected through virtual audio cables (VB-Cable/BlackHole) to tools like Phone Link or FaceTime.
* The Objection Trainer gym to practice rebuttals against an AI prospect.
* The Live Copilot (knowledge base) that searches locally seeded documents to provide on-call hints.
* Basic post-call sentiment analysis and auto-generated follow-up drafts.

**What a founder MUST NOT be told:**
* That the platform has an "autonomous lead hunter" (it can only generate fake demo leads; real outbound requires manual CSV import or entry).
* That it has an integrated native telephony "power dialer" (there is no Twilio or SIP integration; it relies entirely on local UI/audio routing hacks).
* That it is entirely "offline" or "no cloud" for actual usage (the CRM is local, but all AI functionality sends audio, transcripts, and prompts to third-party providers).
* That it is a complete end-to-end autonomous SDR (it has no calendar integration, no autonomous campaigns, no email dispatching, and no robust sequences).

DONE_OK STATUS-SALES.md
