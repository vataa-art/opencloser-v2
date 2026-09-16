# OpenCloser — Your AI Sales Team, On Your Desktop

<div align="center">

![OpenCloser](https://img.shields.io/badge/OpenCloser-AI%20Sales%20Platform-6366f1?style=for-the-badge&logo=robot&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-Backend-000000?style=for-the-badge&logo=rust&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)

[![CI](https://img.shields.io/github/actions/workflow/status/issacops/opencloser-v2/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/issacops/opencloser-v2/actions)
[![Release](https://img.shields.io/github/v/release/issacops/opencloser-v2?include_prereleases&style=flat-square)](https://github.com/issacops/opencloser-v2/releases)
[![Stars](https://img.shields.io/github/stars/issacops/opencloser-v2?style=flat-square)](https://github.com/issacops/opencloser-v2/stargazers)

> **Open-source AI sales platform | Desktop CRM | AI Voice Caller | Sales Automation | Built with Tauri + React + Rust + Gemini**

</div>

---

## ⚡ What is OpenCloser?

OpenCloser is an **open-source, AI-powered sales development platform** that runs entirely on your desktop. It gives you an **AI sales workbench**: a strategist to build your ICP, a demo lead generator (synthetic data), a voice caller to dial prospects, a coach to train your rebuttals, and a manager to analyze calls. No SaaS fees.

> **Privacy note:** your CRM data lives locally, but **Live mode** sends prompts, transcripts, and audio to the AI providers you configure (Gemini / OpenAI / ElevenLabs / Deepgram). Demo mode does not contact any external service.

| | Traditional Sales Team | **OpenCloser** |
|---|---|---|
| **Strategy** | Hire a consultant ($5K+/mo) | AI Strategist generates ICP using SPIN & Challenger in minutes |
| **Research** | SDR manually Googles leads (hours) | Demo Lead Generator produces synthetic leads (real sourcing is a roadmap item) |
| **Cold Calling** | SDR dials 50 calls/day, burns out | AI Caller dials with perfect pitch, never tired |
| **Coaching** | Manager reviews recordings (hours) | AI Coach gives instant post-call analysis |
| **Training** | Roleplay sessions (awkward, infrequent) | AI Sparring Partner available 24/7, adjustable difficulty |
| **Analytics** | Spreadsheets and gut feelings | Real-time dashboards, sentiment analysis, pipeline tracking |
| **Cost** | $15K–50K+/mo in salaries | **Free. Open source.** |

---

## 🎯 Who It's For

- **Solo founders** who need to sell but can't afford a sales team
- **Early-stage startups** that want enterprise-level sales ops from day one
- **Sales teams** looking to augment human reps with AI intelligence
- **Developers** who want to build on top of an open sales AI framework

---

## ✨ Your AI Sales Team

### 🧠 AI Sales Strategist
Generates your Ideal Customer Profile (ICP) using SPIN & Challenger frameworks. Asks the right questions during onboarding to deeply understand your market. Builds targeted outreach strategies automatically.

### 🔍 Demo Lead Generator (Synthetic)
Generates **fictional** demo leads for call rehearsal — it does not scrape websites or source real prospects (real sourcing is a roadmap item). Industry-aware demo mode with 5 keyword categories when no API key is configured. Full local-first CRM with Kanban pipeline management.

### 📞 AI Caller (SDR)
Real-time AI voice agent powered by Google Gemini (also supports OpenAI Realtime and ElevenLabs ConvAI). Virtual audio bridge for phone integration. Live transcription, sentiment analysis, and objection detection. Power dialing mode for high-volume outreach.

### 🎯 AI Sales Coach
Objection sparring trainer with 3 difficulty levels (Rookie, Pro, Elite). Practice handling 12 objection archetypes against an AI prospect. Real-time encouragement and post-session scoring with specific improvement tips.

### 📊 AI Sales Manager
Post-call AI debrief with sentiment analysis and key insights. Auto-generated follow-up emails. Call analytics dashboard with conversion metrics. Pipeline intelligence with live Kanban board.

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) (system dependencies per platform)

### Run the Desktop App

```bash
git clone https://github.com/issacops/opencloser-v2.git
cd opencloser-v2
npm install
npm run tauri dev
```

### No API Key? No Problem.

OpenCloser works fully in **demo mode** with no API key — 10 realistic seed leads, simulated AI calls, and all features functioning with fallback data. Perfect for evaluation.

### Enable Real AI

Add any of these in Settings → Voice Engine:

| Provider | Key |
|----------|-----|
| Google Gemini | `GEMINI_API_KEY` for onboarding, lead hunting, call analysis |
| OpenAI Realtime | `openai_api_key` for voice calling through the built-in relay |
| ElevenLabs ConvAI | `elevenlabs_api_key` + Agent ID for the most human-like voice |
| Deepgram STT | `deepgram_api_key` for live Ukrainian (`uk`) or English (`en-US`) transcription |

---

## 🏗️ Architecture

```
opencloser/
├── src/                         # React 19 frontend (TypeScript strict mode)
│   ├── features/
│   │   ├── crm/                # Kanban pipeline, Dashboard, Settings, Persona
│   │   ├── voice/              # War Room, Post-Call Debrief, Objection Trainer
│   │   ├── hunter/             # Lead hunting engine
│   │   └── onboarding/         # AI onboarding + ICP generation
│   ├── stores/                 # Zustand stores (lead, call, keys, etc.)
│   ├── services/               # Typed Tauri invoke wrappers + secure key storage
│   ├── voice/lib/adapters/     # Per-provider protocol handlers (Gemini/OpenAI/ElevenLabs/Demo)
│   ├── test/                   # Vitest contract + unit tests
│   └── components/             # AppShell, shared UI
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── ai/gemini.rs        # Gemini API + industry-aware demo mocks
│       ├── db/                 # SQLite schema + 10 seed leads + migrations
│       ├── relay/              # WebSocket proxy for OpenAI/ElevenLabs
│       └── lib.rs              # 15 Tauri commands registered
└── public/
    └── audio-processor.worklet.js  # Zero-latency PCM capture
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript strict, Tailwind CSS 3, Vite 6, Zustand 5 |
| **Desktop Runtime** | Tauri 2.10 |
| **Backend** | Rust (rusqlite, reqwest, tokio, tokio-tungstenite) |
| **Database** | SQLite — local-first, zero cloud dependency |
| **AI** | Google Gemini 2.5 Flash, OpenAI Realtime, ElevenLabs ConvAI |
| **Voice** | Web Audio API + AudioWorklet (zero-latency PCM capture) |
| **Tests** | Vitest + React Testing Library (67 tests, 9 suites) + Rust relay contract tests |
| **CI/CD** | GitHub Actions — lint, test, build, cargo check/fmt/clippy/test, Tauri build |

---

## 📦 Platform Support

| Platform | Architecture | Download |
|----------|-------------|----------|
| **macOS** | Apple Silicon (ARM64) | `.dmg` |
| **macOS** | Intel (x64) | `.dmg` |
| **Windows** | x86_64 | `.msi` / `.exe` |
| **Linux** | x86_64 | `.deb` / `.AppImage` / `.rpm` |

All packages available on the [Releases page](https://github.com/issacops/opencloser-v2/releases).

---

## 📊 Project Status

| Metric | |
|--------|-------|
| **TypeScript** | Strict mode, 0 errors |
| **Tests** | 67 passing across 9 suites (frontend) + Rust relay contract tests |
| **Codebase** | 9,400 lines (TS: 7,572 + Rust: 1,185 + CSS: 637) |
| **Bundle** | 312KB main + 5 lazy-loaded chunks |
| **Demo mode** | No API key required — full fallback data |

---

## 🔒 Privacy & Security

- **CRM data stays local** — SQLite database on your machine, never synced to any server. **Live mode** sends prompts, transcripts, and audio to the AI providers you explicitly configure.
- **API keys live in your OS keychain** — Windows Credential Manager, macOS Keychain, or the freedesktop Secret Service. Keys are never written to WebView localStorage (values saved by older builds are migrated and scrubbed on first launch), and they are sent only to the provider you choose.
- **Loopback voice relay** — OpenAI/ElevenLabs/Deepgram audio is proxied by a local 127.0.0.1 relay gated by a per-launch token; provider protocols are translated, not passed through raw.
- **Demo mode is offline** — with no API keys configured, no external service is contacted; demo calls and demo leads are clearly labelled as synthetic.
- **Open source** — every line auditable. MIT license.
- **Offline capable** — demo mode works with zero internet connectivity

---

## 🎙️ Audio Bridge Setup

For AI-to-phone calling, OpenCloser uses a virtual audio cable:

- **Windows:** [VB-Cable](https://vb-audio.com/Cable/) (free)
- **macOS:** [BlackHole](https://existential.audio/blackhole/) (free)
- **Linux:** Use PulseAudio's `null-sink` module

The built-in Audio Setup Wizard guides you through configuration, or skip entirely for VoIP-only mode.

---

## 🤝 Contributing

We welcome contributions! See [AGENTS.md](AGENTS.md) for the full developer guide.

```bash
# Setup
npm install

# TypeScript check (strict mode)
npm run lint

# Run tests
npm test

# Run desktop app
npm run tauri dev
```

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes with clear messages
4. Ensure `npm run lint` and `npm test` pass
5. Open a Pull Request

---

## 🧠 Knowledge Base & Live Copilot

OpenCloser ships with a local vector knowledge base (SQLite + offline hashed
embeddings; Gemini `text-embedding-004` is used automatically when an API key
is configured).

- **Seeding:** on first launch the app ingests `knowledge/recruitment/` —
  course transcripts (`transcripts/*.txt`) and the course catalog
  (`courses.json`) — into the `kb_chunks` table (schema v7, `domain="recruitment"`).
  Seeding is idempotent per source: drop new `.txt` transcripts or extend
  `courses.json` and they are picked up on the next launch.
- **Commands (Tauri):**
  | Command | Purpose |
  |---|---|
  | `kb_ingest_document` | Clean → chunk → embed → store a document |
  | `kb_search` | Top-k semantic search with scores + sources |
  | `copilot_turn` | One live-assist turn: prospect question → KB-grounded suggestion |
- **Live Copilot (sidebar → Live Copilot):** pick the lead you are calling
  (sessions are blocked for DNC / non-consented leads), switch between
  **Sales** and **Recruitment** domains, and get KB-grounded answers with
  source attribution. Mic capture reuses the Deepgram relay; typed questions
  and screening presets work without any microphone.
- **Agentic reasoning:** the objection trainer can call
  `search_knowledge_base` (function-calling round-trip) and the CoachAgent
  flags fabricated statistics that are not backed by knowledge-base sources.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) — Making native desktop apps accessible to web developers
- [Google Gemini](https://deepmind.google/technologies/gemini/) — The AI backbone
- [OpenAI](https://openai.com/) — Realtime voice API
- [ElevenLabs](https://elevenlabs.io/) — Most human-sounding voice synthesis
- [Lucide Icons](https://lucide.dev/) — Beautiful icon set

---

<div align="center">

**Built with ❤️ for sales teams who want an unfair advantage.**

[⭐ Star This Repo](https://github.com/issacops/opencloser-v2/stargazers) · [🐛 Report Bug](https://github.com/issacops/opencloser-v2/issues) · [💡 Request Feature](https://github.com/issacops/opencloser-v2/issues) · [📖 Developer Guide](AGENTS.md)

---

**Keywords:** `ai-sales` `sales-automation` `crm-software` `ai-voice-caller` `desktop-app` `tauri` `open-source-crm` `lead-generation` `cold-calling-software` `sales-coach` `gemini-ai` `react` `typescript` `rust` `sentiment-analysis` `sales-pipeline`

</div>
