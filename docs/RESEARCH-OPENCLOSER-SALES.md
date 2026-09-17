# RESEARCH — OpenCloser sales is the product

**Date:** 2026-09-17  
**Owner:** Roman  
**Code:** `G:/agency/opencloser-v2/project`  
**Rule:** Sales is the whole product. Hiring parasitizes this core. Do not mix hiring iter-5 into sales commits.

Source brief from Roman (this file). Claims below must be re-checked against `project/` before acting.

---

## 1. What OpenCloser sales actually is

Five README roles = five screens around one local SQLite, not five autonomous workers.

| Marketing role | Code (public main) | Reality |
|---|---|---|
| Strategist | Onboarding chat → ICP | `process_onboarding_chat` + Gemini or demo fallback. SPIN/Challenger/Sandler/Straight Line are ICP fields, not engines |
| Lead researcher | LeadHunter + `simulate_lead_scraping` | Name is honest: simulate. No Apollo/Clay/Firecrawl in public tree |
| Caller / SDR | WarRoom + relay + AudioWorklet | Voice to Gemini / OpenAI Realtime / ElevenLabs. PSTN = VB-Cable / BlackHole |
| Coach | ObjectionTrainer | 12 archetypes, 3 levels. Detector = string `includes`, not LLM |
| Manager | PostCallDebrief + Dashboard + Kanban | `analyze_call_transcript` after call + follow-up draft |

Public Tauri sales commands:

`get_leads`, `update_lead_status`, `add_leads`, `delete_lead`, `get_call_logs`, `add_call_log`, `get_lead_call_logs`, `get_lead_notes`, `add_lead_note`, `simulate_lead_scraping`, `process_onboarding_chat`, `analyze_call_transcript`, `objection_trainer_turn`, `get_relay_port`

Local tree is ahead of public README: KB v7, `kb_ingest`/`kb_search`, `copilot_turn`, CoachAgent, Academy (course-sales coaching, not ATS). Public README still says «35 tests / 9400 LOC»; handoff = 98 vitest + 15 kb-core. Trust `project/`.

Missing: sequences, calendar, CRM sync, payment link, power-dialer telephony, cost cap, approval queue, GDPR for leads, updater.

---

## 2. Data model — demo-CRM narrow

LeadStatus: Discovery | Outbound Call | Audit Requested | Closed. Four kanban columns. No SQL/MEDDPICC/Negotiation/Commit.

Lead: name, company, phone, email?, title?, linkedin_url?, notes?, status, score, created_at. No owner, next_step_at, source, sequence_id, timezone, DNC, consent_recording, account vs contact. (Local may already have dnc/consent_at from schema v6 — verify.)

CallSession: provider, duration, transcript, status, sentiment, objections_handled, emotion_log. No talk-ratio, recording_uri, redacted_transcript, model/prompt_hash, next_action.

ICP: audience, industry, size, titles, pains, objections, competitors, valueProp, methodology, systemPrompt. Good persona config, bad hunter source of truth.

Tables: leads, call_logs, campaigns, lead_notes, activities + later KB. Campaigns nearly empty. No autonomous campaigns.

---

## 3. Claim vs code

| README promise | Reality |
|---|---|
| Autonomous AI sales team | Human clicks screens; hunter = simulate |
| No cloud / data never leaves | Live sends prompts/transcripts/audio to providers |
| AI Caller dials with perfect pitch | No PSTN. Virtual cable + wizard |
| Power dialing | No parallel lines, AMD, local presence. UI mode |
| Autonomous hunting/scoring | Demo keywords + Gemini generate-or-mock |
| Sentiment + objection detection | Sentiment from LLM post-call. Live objection = 12 phrase lists, first match |
| Keys in keychain vs localStorage | New paths still dangerous if localStorage remains |
| Offline capable | Demo fallback only |
| production | package.json 0.0.0 |

`detectObjection()`: lowercase + `includes(trigger)`, last 3 user lines, first map hit. Gym hint, not Gong.

Archetypes keep: price, timing, trust, authority, inertia, competitor, technical, roi, no_pain, wrong_fit, gatekeeper, voicemail. Missing: addressed vs open + quote + next line from offer KB.

---

## 4. Gaps to production-ready sales

Hiring spec is already more disciplined. Sales needs the same invariants.

### P0
1. Honest STATUS.md. Live ≠ local. Remove «no cloud dependency».
2. Secrets in OS store, not localStorage.
3. Recording consent before WarRoom live. Lead fields dnc / consent_recording.
4. Voice fail-closed. Relay down ≠ successful call. Transcript/log off audio path + retry.
5. Signed installer + audio wizard cannot silent-skip if phone bridge selected.
6. Token counter per call, stop at daily cap.

### P1
7. Call stage machine (SalesGPT-style): Intro → Qual → Value → Needs → Solution → Objection → Close → End. Analyzer separate from hint.
8. Objection = quote + addressed|open + KB counter.
9. Copilot grounded in offer. Sales retrieval may stay cross-domain; price/guarantee/slot/ROI only with source + updated-at.
10. Talk-ratio, next-step date, unanswered objection in debrief.
11. Human confirm on lead stage change from copilot and on send follow-up. Draft yes, SMTP no.
12. Fixture PCM/transcript WarRoom tests without live Gemini.

### P2
13. Pipeline: New / Working / Meeting / Proposal / Won / Lost + lost_reason.
14. CSV / manual import. Hunter not the only source.
15. Qualify one-pager before call.
16. Never auto-send. 3 email variants + opener + voicemail, stop.
17. Calendar next step (ICS enough).
18. Outbound CRM webhook (HubSpot/Pipedrive), not bidirectional sync.
19. WAL SQLite, backup/restore, `~/.opencloser/profiles/<name>/`.

### P3
20. Real telephony (Twilio Media Streams or SIP); VB-Cable fallback.
21. Parallel dial / AMD only if call-floor is the goal. Do not promise power dialer otherwise.
22. Team, roles, audit log.
23. Auto-update, notarization.
24. Local STT fallback for EU.

GA positioning: not AI SDR replacing a human. OpenCloser sales = local war-room + gym + grounded copilot.

---

## 5. Competitors (see brief)

Commercial: 11x/Artisan vs Nooks/Orum vs Attention/Closer Edge vs Gong vs Clay/Apollo vs HubSpot/Close.

GitHub to read (invariants, not vendor stacks): aura-app, ai-native-crm, SalesGPT, opensource-sales-ops, voice-ai-agent, meetily, LiveAssist, objection-relay, CallSense, rolecall-ai.

---

## 6. Copy invariants, not stacks

objection-engine: quote + addressed + severity; keep 12 archetypes as fast layer.  
WarRoom copilot: stage analyzer + numeric claims only from KB.  
Debrief: talk-ratio, unanswered objections, next action with date.  
Hunter: CSV + never auto-send.  
Status: human confirm on Won/Lost/delete.  
Voice: fail-closed + fixture WS. Do not add Twilio in a UI polish commit.

Minimal debrief schema:

```
objections[]      { archetype, quote, addressed, product_gap }
talk_ratio        0..1
next_step         { action, date, channel }
risks[]           no_dm | no_next_step | monologue | cooling | dnc
followup_draft    text, status=draft
kb_claims_used[]  { source, updated_at }
```

---

## 7. Agent law (sales)

Do: new sales logic in a testable module (kb-core pattern). Phrase-detector stays. Sales copilot stays cross-domain except money/guarantee/timeline. Follow-up = draft. Same npm/cargo gates. Voice not in same commit as CRM schema.

Don't: promise power dialer / autonomous hunter; force vacancy_id on sales retrieval; overwrite Academy scorecard; auto-Closed; send email/SMS/Stripe; add Twilio «заодно»; commit secrets; push issacops; explode LeadStatus to 15 without migration.

---

## 8. Build order if sales is the priority (separate from hiring iter-5)

1. STATUS.md + honest README  
2. Consent/DNC + WarRoom start block  
3. Debrief schema: unanswered + next_step + talk_ratio  
4. Wire existing kb_search into WarRoom hint  
5. Confirm-writes on status/delete  
6. CSV import + kill «autonomous» Hunter label  
7. Fixture voice/transcript test  
8. Then Twilio or budget cap + keychain  

`copilot.rs` = single writer.
