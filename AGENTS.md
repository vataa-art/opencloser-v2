# OpenCloser — Agent Guide

## Project Overview

OpenCloser is a Tauri 2.0 desktop AI sales platform built with React 19, TypeScript, Tailwind CSS, Rust, and SQLite. It provides an entire AI sales team: strategist, lead researcher, voice caller (SDR), coach, and manager — all running locally.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.8, Tailwind CSS 3, Vite 6 |
| Desktop | Tauri 2.10 (Rust backend) |
| Database | SQLite (rusqlite) |
| AI | Google Gemini 2.5 Flash |
| Voice | Web Audio API + AudioWorklet |
| State | Zustand 5 |
| Tests | Vitest + React Testing Library |
| Icons | Lucide React |

## Project Structure

```
opencloser/
├── src/                          # Frontend source
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   ├── constants.ts              # Storage keys, routes, nav config
│   ├── types.ts                  # Lead, ICP, Campaign, CallSession
│   ├── types/persona.ts          # AIPersona, voice presets
│   ├── index.css                 # Global styles, Tailwind, animations
│   ├── components/               # Shared components
│   │   └── AppShell.tsx          # Header + sidebar layout
│   ├── stores/                   # Zustand state management
│   │   ├── lead.store.ts         # Leads CRUD, search, filter
│   │   ├── call.store.ts         # Call state, active call, debrief
│   │   ├── onboarding.store.ts   # ICP interview flow
│   │   ├── persona.store.ts      # AI persona configuration
│   │   ├── navigation.store.ts   # App routing state
│   │   └── toast.store.ts        # Toast notifications
│   ├── services/                 # Tauri invoke wrappers
│   │   ├── lead.service.ts       # getLeads, updateLeadStatus, etc.
│   │   ├── onboarding.service.ts # processOnboardingChat
│   │   ├── secure-keys.ts        # OS keychain access for provider secrets
│   │   └── ai.service.ts         # Demo lead generation, call analysis
│   ├── stores/keys.store.ts      # Runtime provider-key store (keychain-backed)
│   ├── ui/components/            # Toast, future shared UI
│   ├── test/                     # Test files (unit + provider contract tests)
│   │   ├── setup.ts              # Vitest setup
│   │   ├── helpers/mock-ws.ts    # WebSocket/invoke test doubles
│   │   ├── emotion-engine.test.ts
│   │   ├── objection-engine.test.ts
│   │   └── providers.test.ts
│   └── features/
│       ├── crm/components/       # KanbanBoard, Dashboard, LeadDetail, Settings, PersonaBuilder, CallLogs
│       ├── voice/components/     # WarRoom (+ warroom/ panels), PostCallDebrief, ObjectionTrainer, VoiceVisualizer
│       ├── voice/lib/            # caller-engine gateway, adapters/ (Gemini/OpenAI/ElevenLabs/Demo), emotion/objection engines, providers
│       ├── hunter/components/    # LeadHunter
│       └── onboarding/components/ # Onboarding, ICPDisplay, AudioSetupWizard
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── lib.rs                # Tauri app builder + invoke handlers
│       ├── main.rs               # Entry point
│       ├── ai/gemini.rs          # Gemini API + all mock/fallback logic
│       ├── db/schema.rs          # Schema init + migrations + seeds
│       └── db/commands.rs        # CRUD Tauri commands
├── public/
│   └── audio-processor.worklet.js # AudioWorklet PCM capture
├── vitest.config.ts              # Test configuration
├── tsconfig.json                 # TypeScript strict mode
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite dev server (for web testing) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check (strict mode) |
| `npm test` | Run all Vitest tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Test coverage report |
| `npm run tauri dev` | Start Tauri desktop app |
| `npm run tauri build` | Build desktop binaries |

Rust gates (windows-gnu toolchain on this machine — MSVC is not installed):

```bash
export CARGO_HOME=/g/tools/cargo RUSTUP_HOME=/g/tools/rustup
export PATH="/g/tools/cargo/bin:/g/tools/mingw64/mingw64/bin:$PATH"
cargo +stable-x86_64-pc-windows-gnu check            # from src-tauri/
cargo +stable-x86_64-pc-windows-gnu test -p kb-core  # pure-KB unit + acceptance tests
```

Note: debug `cargo test`/`build` of the app crate links `app_lib.dll` (cdylib)
which exceeds the 65 535 PE export-ordinal limit on windows-gnu — Rust unit
tests therefore live in the dependency-free `src-tauri/crates/kb-core` crate.

Knowledge Base: schema v7 adds `kb_chunks`; seeding ingests
`knowledge/recruitment/` (transcripts + courses.json) idempotently per source.
Tauri commands: `kb_ingest_document`, `kb_search`, `copilot_turn` (see
`src/services/kb.service.ts` and `src/features/copilot/`).

## Conventions

### TypeScript
- **Strict mode enabled** — all code must pass `tsc --noEmit`
- Use explicit types for all function parameters and returns
- Avoid `any` — use `unknown` or proper interfaces
- Path alias: `@/` maps to project root

### Components
- Functional components (no classes)
- Props interfaces named `{ComponentName}Props`
- Export named functions, not defaults (except App.tsx)
- Use Tailwind utility classes, not inline styles (except dynamic values with `var()`)

### State
- Use Zustand stores in `src/stores/`
- Services in `src/services/` wrap all Tauri `invoke()` calls
- localStorage access goes through try/catch
- Provider API keys are secrets: read/write them only via `services/secure-keys.ts` / `stores/keys.store.ts` (OS keychain). Never `localStorage.setItem` a key directly; non-secret settings (agent id, device ids, language) may stay in localStorage.

### Demo / Fallback Mode
- When no `GEMINI_API_KEY` is set, all AI features fall back to realistic demo data
- Demo mode indicator shown in header
- All fallback data is in `src-tauri/src/ai/gemini.rs`

## Database

SQLite via rusqlite. 5 tables:
- `leads` — 12 columns including enriched contact fields
- `call_logs` — transcripts, sentiment, objection tracking
- `campaigns` — lead hunting campaigns
- `lead_notes` — freeform notes per lead
- `activities` — activity log

Migrations run automatically via `run_migrations()` in schema.rs. Seed data (10 leads + 3 call logs + 1 note) inserted on first run.

## CI/CD

- **CI** (push/PR to main): lint + test (Node 18/20/22) + build + cargo check
- **Release** (tag v*): builds for macOS/Linux/Windows via GitHub Actions, attaches binaries to draft release

## Contribution

1. Run `npm run lint` before committing
2. Run `npm test` before pushing
3. Add tests for new features
4. Update AGENTS.md if adding new directories/patterns

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
