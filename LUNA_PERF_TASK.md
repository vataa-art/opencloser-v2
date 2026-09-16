# TASK: OpenCloser smoothness — no UI lag

You are GPT-5.6 Luna, a coding subagent. Work in:

G:\agency\opencloser-v2\project

Language of the final report: Ukrainian.
Last stdout line MUST be exactly: LUNA_PERF_DONE

Do not install MSVC. Do not call live Gemini/OpenAI/ElevenLabs APIs. Do not revert DNC/compliance or keychain work. Do not git init.

## Goal

The desktop UI must stay smooth (Kanban + War Room). Current jank sources already identified:

1. `src/features/voice/components/VoiceVisualizer.tsx` — TWO canvases run requestAnimationFrame forever, each drawing 48 linear gradients + radial glows every frame, even when idle. Parent session may already throttle this file. If it already skips rAF when idle and uses solid strokes, leave it. If not, fix it.
2. `LeadCard.tsx` — every "Outbound Call" card has `animate-pulse-glow` forever. Keep a static badge; pulse only if you add an explicit `isLive` prop for the one active call.
3. `WarRoom.tsx` — `loadPersona()` runs on every render via IIFE. Memoize. Emotion `useEffect` re-analyzes the full transcript; window to the last ~20 lines and batch setState.
4. `playAudio` — `atob` + per-byte `charCodeAt` on every PCM chunk. Make the hot path cheaper without changing audible output.
5. Memo `LeadCard` / avoid KanbanBoard rebuilding the whole board on toast/timer. Do not change CRM behaviour.
6. Heavy CSS: `stagger-children` on long columns, infinite glow/blur. Prefer transform/opacity only. No `filter: blur` on scrolling lists.

## Verify

```
unset PYTHONPATH PYTHONHOME VIRTUAL_ENV
npm run lint
npm test
npm run build
```

Write `G:\agency\opencloser-v2\project\PERF_REPORT.md` with: what you changed, why it reduces main-thread work, test counts, leftover lag risks.

Do not run `npx tauri build`.
