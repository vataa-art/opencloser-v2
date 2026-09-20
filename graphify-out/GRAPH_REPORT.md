# Graph Report - private-v2-cartesia-final  (2026-09-20)

## Corpus Check
- 196 files · ~103,682 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .example 1, .icns 1)

## Summary
- 1371 nodes · 2636 edges · 93 communities (75 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9efe458b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- keys.store.ts
- ValidatorError
- kb-core/src/lib.rs
- src/pipeline.rs
- AIPersonaBuilder.tsx
- OpenCloser — Your AI Sales Team, On Your Desktop
- agy.rs
- relay/mod.rs
- KanbanBoard.tsx
- gemini.rs
- AppShell.tsx
- copilot/readiness-gate.ts
- commands.rs
- coach-agent.ts
- package.json
- compilerOptions
- fixture-transcript.test.ts
- types.ts
- CopilotView.tsx
- Lead
- tauri.conf.json
- Handoff: opencloser-v2 sandbox
- opencode.json
- devDependencies
- configs-parity.test.ts
- LeadDetailView.tsx
- WarRoom.tsx
- relay-protocol/src/lib.rs
- copilot-engine.ts
- hiring.ts
- RESEARCH — OpenCloser sales is the product
- CopilotView
- VacancyIntake.tsx
- CopilotPanel.tsx
- PostCallDebrief.tsx
- RecruitmentKnowledgeView.tsx
- lead.service.ts
- progress-metrics.test.ts
- WarRoom
- emotion-engine.ts
- ddl.rs
- copilot_turn
- Part B — Remaining production work (implement)
- P1 — Recruitment Hiring vertical (schema v7 → v8)
- DashboardHome.tsx
- compliance.ts
- Handoff — OpenCloser P1 Hiring (iter-5+)
- dependencies
- scripts
- Production audit — OpenCloser v2 (раунд 3)
- assert_callable
- schema.rs
- OpenCloser performance report
- entry
- Automated gates
- card.rs
- src-tauri/src/lib.rs
- WORKFLOW_STATE — OpenCloser v2
- OpenCloser v2 — project context
- P0 mission (do in order)
- Agent Instructions — OpenCloser Sales Core
- 1. Domain model (migration v8)
- OpenCloser Sales Debrief Schema vNext (Design)
- GOAL — OpenCloser v2 cyclic improvement
- Design — Cartesia Sonic brand seller
- Rust / Tauri backend (OpenCloser)
- Requirements — Cartesia Sonic brand seller
- default.json
- React / TS / Vite (OpenCloser)
- OpenCloser Sales Feature Status
- pcm.ts
- STATUS — OpenCloser sales (honest)
- ITERATION_LOG — OpenCloser v2
- TASK: OpenCloser smoothness — no UI lag
- app
- PCMCaptureProcessor
- @vitejs/plugin-react
- sim-violations.test.ts
- Verify before done
- opencloser.md
- windows-dev-paths/SKILL.md
- implementor.md
- supervisor.md
- tester.md

## God Nodes (most connected - your core abstractions)
1. `vitest` - 30 edges
2. `getProviderKey()` - 29 edges
3. `react` - 28 edges
4. `ValidatorError` - 28 edges
5. `lucide-react` - 26 edges
6. `Lead` - 26 edges
7. `CopilotView()` - 24 edges
8. `WarRoom()` - 22 edges
9. `ICP` - 21 edges
10. `compilerOptions` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Goal of next session` --references--> `VacancyIntake()`  [INFERRED]
  docs/HANDOFF-P1-HIRING.md → src/features/recruitment/hiring/VacancyIntake.tsx
- `Architecture` --references--> `CartesiaCallerEngine`  [INFERRED]
  .kiro/specs/cartesia-sonic-brand-seller/design.md → src/features/voice/lib/adapters/cartesia.adapter.ts
- `3. Claim vs code` --references--> `detectObjection()`  [INFERRED]
  docs/RESEARCH-OPENCLOSER-SALES.md → src/features/voice/lib/objection-engine.ts
- `Claims Verification Table` --references--> `detectObjection()`  [INFERRED]
  docs/STATUS-SALES.md → src/features/voice/lib/objection-engine.ts
- `Implementor Constraints` --references--> `LeadStatus`  [INFERRED]
  docs/AGENTS-SALES-INSTRUCTIONS.md → src/types.ts

## Import Cycles
- 1-file cycle: `src-tauri/crates/hiring-core/src/validate.rs -> src-tauri/crates/hiring-core/src/validate.rs`

## Communities (93 total, 18 thin omitted)

### Community 0 - "keys.store.ts"
Cohesion: 0.06
Nodes (40): Tasks — Cartesia Sonic brand seller, vitest, attachRelayHandlers(), bytesToBase64(), CallerEngine, EngineCallbacks, float32ToPcm16(), openRelayConnection() (+32 more)

### Community 1 - "ValidatorError"
Cohesion: 0.05
Nodes (65): Formatter, KbIngestResult, Display, Error, Result, Self, String, Vec (+57 more)

### Community 2 - "kb-core/src/lib.rs"
Cohesion: 0.09
Nodes (53): Candidate, chunk_text(), chunk_text_respects_max_chars_and_overlaps(), collapse_whitespace(), cosine_similarity(), DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP, embed_local() (+45 more)

### Community 3 - "src/pipeline.rs"
Cohesion: 0.06
Nodes (34): contact(), email_duplicate_found_case_insensitive(), find_duplicate_contact(), normalize_contact(), phone_duplicate_found_across_formats(), Option, String, Vec (+26 more)

### Community 4 - "AIPersonaBuilder.tsx"
Cohesion: 0.07
Nodes (38): Audit hotspots in this repo, Hard rules, Tauri 2 desktop security (OpenCloser), Verification checklist, AIPersonaBuilder(), AIPersonaBuilderProps, FRAMEWORKS, PRESET_OPTIONS (+30 more)

### Community 5 - "OpenCloser — Your AI Sales Team, On Your Desktop"
Cohesion: 0.04
Nodes (45): CI/CD, Components, Contribution, Conventions, Database, Demo / Fallback Mode, graphify, OpenCloser — Agent Guide (+37 more)

### Community 6 - "agy.rs"
Cohesion: 0.10
Nodes (39): Arc, AsyncMutex, AtomicU64, Child, FnOnce, HashMap, Path, AgyAgentDescriptor (+31 more)

### Community 7 - "relay/mod.rs"
Cohesion: 0.13
Nodes (35): Box, Message, ProviderWs, RelayPort, adapt_client_audio(), CARTESIA_API_VERSION, cartesia_audio_and_conversation_events_are_translated(), connect_cartesia() (+27 more)

### Community 8 - "KanbanBoard.tsx"
Cohesion: 0.09
Nodes (26): 4. `cancel_agy_agent` була зареєстрована, але без UI (P3, виправлено), lucide-react, react, @tauri-apps/plugin-shell, App(), AgyAgent, AgyJob, AgyTeamView() (+18 more)

### Community 9 - "gemini.rs"
Cohesion: 0.15
Nodes (33): extract_text(), extract_tool_call(), extracts_tool_call_query(), full_mocked_round_trip_reaches_final_text(), function_round_appends_model_then_tool_response(), kb_tool_declaration(), KB_TOOL_NAME, MAX_TOOL_ROUNDS (+25 more)

### Community 10 - "AppShell.tsx"
Cohesion: 0.11
Nodes (20): zustand, AppShell(), AppShellProps, SIDEBAR_ICON_MAP, APP_DESCRIPTION, APP_TITLE, LEAD_STATUSES, NAV_ITEMS (+12 more)

### Community 11 - "copilot/readiness-gate.ts"
Cohesion: 0.13
Nodes (23): RECRUITMENT_ARCHETYPES, RecruitmentArchetype, emptyReadinessStats, evaluateReadiness(), FLOW_STAGES_REQUIRED, loadReadinessStats(), maybeRecordFullFlowRun(), ReadinessStats (+15 more)

### Community 12 - "commands.rs"
Cohesion: 0.29
Nodes (25): add_call_log(), add_lead_note(), add_leads(), ALLOWED_LEAD_STATUSES, assert_lead_callable(), CallLog, delete_lead(), get_call_logs() (+17 more)

### Community 13 - "coach-agent.ts"
Cohesion: 0.17
Nodes (21): 3. Readiness-gate критерій «вигадана статистика» був мертвим (P1, виправлено), detectJobPromiseViolation(), detectSimViolations(), SimViolations, claimSupported(), coachAdvise(), createDebouncedCoach(), extractOfferClaims() (+13 more)

### Community 14 - "package.json"
Cohesion: 0.09
Nodes (22): name, private, type, version, autoprefixer, dotenv, @google/genai, jsdom (+14 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+14 more)

### Community 16 - "fixture-transcript.test.ts"
Cohesion: 0.17
Nodes (16): buildSalesDebrief(), DebriefObjection, DebriefRisk, SalesDebrief, talkRatio(), TranscriptLine, wordCount(), detectObjection() (+8 more)

### Community 17 - "types.ts"
Cohesion: 0.16
Nodes (14): ICPDisplay(), ICPDisplayProps, Message, Onboarding(), OnboardingProps, WarRoomProps, processOnboardingChat(), Message (+6 more)

### Community 18 - "CopilotView.tsx"
Cohesion: 0.21
Nodes (13): CriterionDef, ScoreBandDef, SCORECARD_BANDS, SCORECARD_CRITERIA, ScoreValue, CriterionScores, scoreCandidate(), SCORECARD_MAX (+5 more)

### Community 19 - "Lead"
Cohesion: 0.18
Nodes (15): KanbanColumn, KanbanColumnProps, STATUS_STYLE, LeadCardProps, LeadDetailViewProps, COLUMNS, PipelineBoard, PipelineBoardProps (+7 more)

### Community 20 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 21 - "Handoff: opencloser-v2 sandbox"
Cohesion: 0.12
Nodes (16): 2026-09-14: audit remediation (frontend honesty + relay/AGY hardening), Handoff: opencloser-v2 sandbox, Known non-goals / facts for next agent, Local patches already applied (sandbox only), One-line status, P0 — before any real API keys / external users, P1 — release hygiene, P2 — product (+8 more)

### Community 22 - "opencode.json"
Cohesion: 0.12
Nodes (16): agent, implementor, supervisor, tester, description, mode, model, model (+8 more)

### Community 23 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, dotenv, jsdom, postcss, tailwindcss, @tauri-apps/cli, @testing-library/jest-dom (+9 more)

### Community 24 - "configs-parity.test.ts"
Cohesion: 0.16
Nodes (12): CheatSheetFact, PRECALL_CHEATSHEET_FACTS, MANAGER_METRICS, MetricDef, PERSONAL_METRICS, WEEKLY_SUMMARY_NOTE, READINESS_ON_FAIL, READINESS_REQUIREMENTS (+4 more)

### Community 25 - "LeadDetailView.tsx"
Cohesion: 0.21
Nodes (13): LeadDetailView, CallLog, LeadDetailView(), LeadNote, STATUSES, ConfirmWriteKind, confirmWritePrompt(), requiresConfirm() (+5 more)

### Community 26 - "WarRoom.tsx"
Cohesion: 0.26
Nodes (14): WarRoom, EmotionState, IntelPanel, IntelPanelProps, TranscriptPanel, TranscriptPanelProps, SENTIMENT_CONFIG, SentimentLevel (+6 more)

### Community 27 - "relay-protocol/src/lib.rs"
Cohesion: 0.22
Nodes (12): adapt_cartesia_client_audio(), cartesia_session_payload(), client_pcm_is_wrapped_as_audio_input(), handoff_and_provider_errors_are_translated(), json_text(), provider_audio_transcript_and_interruption_are_translated(), RelayFrame, String (+4 more)

### Community 28 - "copilot-engine.ts"
Cohesion: 0.20
Nodes (11): buildTranscriptWindow(), COPILOT_PAUSE_MS, COPILOT_WINDOW_LINES, CopilotBufferState, CopilotTriggerDecision, CopilotTriggerState, hasPendingProspectContent(), initialCopilotState (+3 more)

### Community 29 - "hiring.ts"
Cohesion: 0.17
Nodes (13): CandidateContact, CandidateInput, candidateUpsert(), HiringError, MoveResult, pipelineMove(), PublishResult, UpsertResult (+5 more)

### Community 30 - "RESEARCH — OpenCloser sales is the product"
Cohesion: 0.14
Nodes (13): 1. What OpenCloser sales actually is, 2. Data model — demo-CRM narrow, 3. Claim vs code, 4. Gaps to production-ready sales, 5. Competitors (see brief), 6. Copy invariants, not stacks, 7. Agent law (sales), 8. Build order if sales is the priority (separate from hiring iter-5) (+5 more)

### Community 31 - "CopilotView"
Cohesion: 0.35
Nodes (12): CopilotView(), advanceStage(), computeRedFlags(), currentStage(), detectForbiddenTopic(), detectRecruitmentObjection(), FORBIDDEN_PATTERNS, initialFlowProgress (+4 more)

### Community 32 - "VacancyIntake.tsx"
Cohesion: 0.20
Nodes (10): VacancyIntake, EMPTY_DRAFT, STEPS, toPayload(), VacancyDraft, VacancyIntake(), validateDraft(), isHiringError() (+2 more)

### Community 33 - "CopilotPanel.tsx"
Cohesion: 0.19
Nodes (11): FlowQuestion, FlowStage, SCREENING_FLOW, ScreeningFlow, COPILOT_PRESETS, CopilotDomain, CopilotPanel, CopilotPanelProps (+3 more)

### Community 34 - "PostCallDebrief.tsx"
Cohesion: 0.18
Nodes (10): PostCallDebrief, CallAnalysis, PostCallDebrief(), PostCallDebriefProps, TranscriptEntry, analyzeCallTranscript(), CallAnalysis, LeadResult (+2 more)

### Community 35 - "RecruitmentKnowledgeView.tsx"
Cohesion: 0.17
Nodes (10): RecruitmentKnowledgeView, COVERAGE_LABELS, FILTERS, RECRUITMENT_COURSES, RecruitmentCourse, RecruitmentKnowledgeViewProps, byId, manifest (+2 more)

### Community 36 - "lead.service.ts"
Cohesion: 0.15
Nodes (5): addLeadNote(), assertLeadCallable(), CallLog, getLeads(), LeadNote

### Community 37 - "progress-metrics.test.ts"
Cohesion: 0.27
Nodes (9): CallMetricEvent, inWindow(), managerAutoFlag(), mean(), SimMetricEvent, top3ToImprove(), weeklyProgress, emptyProgress (+1 more)

### Community 38 - "WarRoom"
Cohesion: 0.32
Nodes (9): WarRoom(), buildCallSystemPrompt(), buildCoachingHints(), formatTimer(), getCallPhase(), getSentimentFromMood(), loadPersona(), SENTIMENT_ORDER (+1 more)

### Community 39 - "emotion-engine.ts"
Cohesion: 0.21
Nodes (10): analyzeEmotions(), BUYING_SIGNALS, countWords(), detectSignals(), EmotionAnalysis, EXCITEMENT_SIGNALS, FRUSTRATION_SIGNALS, HOSTILE_SIGNALS (+2 more)

### Community 40 - "ddl.rs"
Cohesion: 0.17
Nodes (9): CANDIDATE_PIPELINE_DDL, CANDIDATES_DDL, KB_CHUNKS_ADD_DOC_TYPE_COL, KB_CHUNKS_ADD_VACANCY_ID_COL, KB_CHUNKS_V8_INDEX, KB_CHUNKS_V8_STEPS, SCORECARDS_DDL, SCREENING_SESSIONS_DDL (+1 more)

### Community 41 - "copilot_turn"
Cohesion: 0.27
Nodes (9): copilot_turn(), CopilotSuggestion, last_prospect_line(), AppHandle, Option, Result, String, Value (+1 more)

### Community 42 - "Part B — Remaining production work (implement)"
Cohesion: 0.18
Nodes (10): B1. Package identity (P1), B2. CI npm arborist workaround, B3. Honest release copy, B4. Compliance layer: DNC / opt-out / consent (P2 product, production-blocking for a dialer), B5. HANDOFF.md, Part A — Verify claimed work (evidence, not narrative), Part B — Remaining production work (implement), Part C — Verification you must re-run after edits (+2 more)

### Community 43 - "P1 — Recruitment Hiring vertical (schema v7 → v8)"
Cohesion: 0.18
Nodes (11): 10. Definition of Done (acceptance tests), 2. Pipeline stages, 3. Screening flow (hiring — not the sales/course flow), 4. Copilot in hiring mode, 5. Guardrails (hard block, not a hint), 6. Screens (`src/features/recruitment/hiring/`), 7. New Tauri commands (additive; current handler has 15+ commands in `lib.rs`), 8. Readiness gate + metrics (+3 more)

### Community 44 - "DashboardHome.tsx"
Cohesion: 0.33
Nodes (8): CallLog, DashboardHome(), DashboardHomeProps, CsvLeadDraft, parseCsvRow(), parseLeadsCsv(), serializeLeadsCsv(), splitCsvRows()

### Community 45 - "compliance.ts"
Cohesion: 0.40
Nodes (7): KanbanBoard(), LeadCard, canStartDemoCall(), canStartLiveCall(), hasConsent(), isDoNotCall(), liveCallBlockReason()

### Community 46 - "Handoff — OpenCloser P1 Hiring (iter-5+)"
Cohesion: 0.20
Nodes (8): Artifacts (reference only — do NOT duplicate), First commands after pickup, Goal of next session, Handoff — OpenCloser P1 Hiring (iter-5+), Open decisions, Skills to use (next session), State of play, Stop conditions

### Community 47 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, @google/genai, lucide-react, motion, react, react-dom, @tauri-apps/api, @tauri-apps/plugin-shell (+2 more)

### Community 48 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, lint, preview, tauri, test, test:coverage (+2 more)

### Community 49 - "Production audit — OpenCloser v2 (раунд 3)"
Cohesion: 0.20
Nodes (9): 1. KB-сівинг не працював на чистому checkout (P0, виправлено), 2. Acceptance-тест kb-core падав на чистому checkout (P0, виправлено), 5. Мертвий код і дрібниці (P3, виправлено), Production audit — OpenCloser v2 (раунд 3), Гейти (незалежний прогін, ця машина — Linux sandbox), Знайдені недопрацювання та фікси цього раунду, Наступний крок, Що далі не зроблено (чесні блокери) (+1 more)

### Community 50 - "assert_callable"
Cohesion: 0.36
Nodes (8): assert_callable(), assert_live_callable(), dnc_blocks_demo_and_live(), live_call_requires_consent(), opt_out_timestamp_blocks(), Option, Result, String

### Community 51 - "schema.rs"
Cohesion: 0.38
Nodes (9): BASE_SCHEMA, init(), AppHandle, Connection, run_migrations(), SCHEMA_VERSION, seed_data(), set_user_version() (+1 more)

### Community 52 - "OpenCloser performance report"
Cohesion: 0.22
Nodes (7): OpenCloser performance report, Залишкові ризики лагів, Зміни, Перевірка, Чому це зменшує main-thread роботу, VoiceVisualizer(), VoiceVisualizerProps

### Community 53 - "entry"
Cohesion: 0.50
Nodes (8): entry(), Option, Result, String, secret_delete(), secret_get(), secret_set(), SERVICE

### Community 54 - "Automated gates"
Cohesion: 0.25
Nodes (7): Automated gates, Frontend, Manual/live validation boundary, QA evidence — Cartesia Sonic brand seller, Repository hygiene, Rust, Verified API contract

### Community 55 - "card.rs"
Cohesion: 0.43
Nodes (6): card_contains_every_field_value(), card_lists_must_have_and_nice_to_have_separately(), render_vacancy_card(), String, Vacancy, vacancy()

### Community 56 - "src-tauri/src/lib.rs"
Cohesion: 0.46
Nodes (6): get_relay_port(), get_relay_token(), RelayState, Mutex, State, String

### Community 57 - "WORKFLOW_STATE — OpenCloser v2"
Cohesion: 0.25
Nodes (7): Blockers, Dirty files (uncommitted), Next decision for supervisor, Parallelism rule, Plan for the next coding session, Source identity, WORKFLOW_STATE — OpenCloser v2

### Community 58 - "OpenCloser v2 — project context"
Cohesion: 0.29
Nodes (6): Already done (do not redo), Canonical paths, OpenCloser v2 — project context, Owner rules, Rebuild env (Windows), Stack

### Community 59 - "P0 mission (do in order)"
Cohesion: 0.29
Nodes (6): 1. Secure API key storage, 2. Voice relay app-auth, 3. Hygiene if time, Deliverable, Out of scope this run, P0 mission (do in order)

### Community 60 - "Agent Instructions — OpenCloser Sales Core"
Cohesion: 0.29
Nodes (6): Agent Instructions — OpenCloser Sales Core, Architecture & Rules, Implementor Constraints, P0→P1 Build Order, Stop Conditions, Workspace & Gates

### Community 61 - "1. Domain model (migration v8)"
Cohesion: 0.29
Nodes (7): 1. Domain model (migration v8), candidate_pipeline, candidates, kb_chunks (already exists), scorecards, screening_sessions, vacancies

### Community 62 - "OpenCloser Sales Debrief Schema vNext (Design)"
Cohesion: 0.29
Nodes (6): 1. Current `call_logs` Columns, 2. Additive vNext Fields / JSON Schema, 3. Computing `talk_ratio` (Heuristic), 4. Migration Strategy: Avoiding v8 Collision with Hiring, 5. Proving Tests (Test Plan), OpenCloser Sales Debrief Schema vNext (Design)

### Community 63 - "GOAL — OpenCloser v2 cyclic improvement"
Cohesion: 0.29
Nodes (6): Acceptance criteria, Goal, GOAL — OpenCloser v2 cyclic improvement, Out of scope this cycle, Roles, Stop conditions

### Community 64 - "Design — Cartesia Sonic brand seller"
Cohesion: 0.29
Nodes (6): Architecture, Current API contract, Design — Cartesia Sonic brand seller, Failure handling, Runtime context, Security

### Community 65 - "Rust / Tauri backend (OpenCloser)"
Cohesion: 0.33
Nodes (5): After Rust edits, Build, Env, Rust / Tauri backend (OpenCloser), Style

### Community 66 - "Requirements — Cartesia Sonic brand seller"
Cohesion: 0.33
Nodes (5): Acceptance criteria, Functional requirements, Goal, Out of scope, Requirements — Cartesia Sonic brand seller

### Community 67 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 68 - "React / TS / Vite (OpenCloser)"
Cohesion: 0.40
Nodes (4): Commands, Conventions, Do not, React / TS / Vite (OpenCloser)

### Community 69 - "OpenCloser Sales Feature Status"
Cohesion: 0.40
Nodes (4): Claims Verification Table, Founder Capabilities: Reality Check, Honest Product Status, OpenCloser Sales Feature Status

### Community 70 - "pcm.ts"
Cohesion: 0.60
Nodes (3): decodeBase64Bytes(), decodeBase64Pcm(), Uint8ArrayBase64Constructor

### Community 71 - "STATUS — OpenCloser sales (honest)"
Cohesion: 0.40
Nodes (4): Do not tell a founder, Live ≠ local, STATUS — OpenCloser sales (honest), What works today

### Community 72 - "ITERATION_LOG — OpenCloser v2"
Cohesion: 0.50
Nodes (3): audit-fix round 3 — 2026-09-18 (Hoplite), iter-0 — 2026-09-16, ITERATION_LOG — OpenCloser v2

### Community 73 - "TASK: OpenCloser smoothness — no UI lag"
Cohesion: 0.50
Nodes (3): Goal, TASK: OpenCloser smoothness — no UI lag, Verify

### Community 74 - "app"
Cohesion: 0.50
Nodes (4): app, hiring-core, kb-core, relay-protocol

## Knowledge Gaps
- **439 isolated node(s):** `$schema`, `_status`, `model`, `mode`, `model` (+434 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 606 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `keys.store.ts` to `AIPersonaBuilder.tsx`, `AppShell.tsx`, `copilot/readiness-gate.ts`, `coach-agent.ts`, `package.json`, `fixture-transcript.test.ts`, `CopilotView.tsx`, `configs-parity.test.ts`, `LeadDetailView.tsx`, `copilot-engine.ts`, `hiring.ts`, `CopilotView`, `RecruitmentKnowledgeView.tsx`, `progress-metrics.test.ts`, `WarRoom`, `emotion-engine.ts`, `DashboardHome.tsx`, `compliance.ts`, `pcm.ts`, `sim-violations.test.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `react` connect `KanbanBoard.tsx` to `VacancyIntake.tsx`, `CopilotPanel.tsx`, `PostCallDebrief.tsx`, `RecruitmentKnowledgeView.tsx`, `AIPersonaBuilder.tsx`, `AppShell.tsx`, `copilot/readiness-gate.ts`, `DashboardHome.tsx`, `compliance.ts`, `package.json`, `types.ts`, `CopilotView.tsx`, `Lead`, `OpenCloser performance report`, `LeadDetailView.tsx`, `WarRoom.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `KanbanBoard.tsx` to `VacancyIntake.tsx`, `CopilotPanel.tsx`, `PostCallDebrief.tsx`, `RecruitmentKnowledgeView.tsx`, `AIPersonaBuilder.tsx`, `AppShell.tsx`, `copilot/readiness-gate.ts`, `DashboardHome.tsx`, `compliance.ts`, `package.json`, `types.ts`, `Lead`, `LeadDetailView.tsx`, `WarRoom.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getProviderKey()` (e.g. with `kb.service.test.ts` and `sim-violations.test.ts`) actually correct?**
  _`getProviderKey()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `_status`, `model` to the rest of the system?**
  _439 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `keys.store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05515832482124617 - nodes in this community are weakly interconnected._
- **Should `ValidatorError` be split into smaller, more focused modules?**
  _Cohesion score 0.05028305028305028 - nodes in this community are weakly interconnected._