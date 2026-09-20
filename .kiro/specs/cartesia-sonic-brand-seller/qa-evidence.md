# QA evidence — Cartesia Sonic brand seller

Date: 2026-09-20
Branch: `feat/cartesia-sonic-brand-seller-v2`
Base: `private/docs/p1-hiring-handoff`

## Verified API contract

Checked against Cartesia's official Managed Agents documentation:

- WebSocket endpoint: `wss://api.cartesia.ai/v1/agents/websocket/{agent_id}`
- Version query parameter: `cartesia_version=2026-08-14`
- Authentication header: `X-API-Key`
- Initial event: `session_create`
- Audio: `pcm_16000` input, `speaking_pace` output
- OpenCloser context: `dynamic_variables.opencloser_context`
- Events covered: `session_ready`, `audio_input`, `audio_output`, `audio_output_clear`, `turn_ended`, `client_tool_call`, `client_tool_result`, `error`
- Provider metadata: current Sonic 3.6

Sources:

- <https://docs.cartesia.ai/line/integrations/websocket-api.md>
- <https://docs.cartesia.ai/api-reference/agents/agent-websocket.md>
- <https://docs.cartesia.ai/agents/dynamic-variables.md>
- <https://docs.cartesia.ai/agents/client-tools.md>
- <https://docs.cartesia.ai/build-with-cartesia/tts-models/latest.md>

## Automated gates

### Frontend

- `npm run lint` — PASS (`tsc --noEmit`)
- `npm run typecheck` — PASS (`tsc --noEmit`)
- `npm test` — PASS: 28 files, 193 tests
- `npm run build` — PASS: Vite production build, 1,755 modules transformed
- Targeted Cartesia/provider/War Room tests — PASS

### Rust

- `cargo +stable-x86_64-pc-windows-gnu fmt -p relay-protocol -- --check` — PASS
- `cargo +stable-x86_64-pc-windows-gnu test -p relay-protocol` — PASS: 5 tests, 0 failed
- `cargo +stable-x86_64-pc-windows-gnu check -p app --lib` — PASS

The pure Cartesia relay protocol lives in the dependency-light `relay-protocol` workspace crate. This follows the repository's Windows/Tauri convention: app-crate test binaries link `WebView2Loader.dll` before `main` and cannot execute reliably on this GNU toolchain, while protocol tests run and prove the actual code imported by `src/relay/mod.rs`.

Covered relay behavior:

- `session_create` payload and `opencloser_context`
- strict Agent ID validation
- PCM16 `audio_input` framing
- output audio decoding
- final assistant/user transcript mapping
- interruption mapping
- human handoff tool-call mapping
- provider error mapping
- session-ready handshake detection

### Repository hygiene

- `git diff --check` — PASS
- Embedded Cartesia key pattern scan — 0 matches
- Stale `sonic-3.5` / `Sonic 3.5` scan — 0 matches

## Manual/live validation boundary

Not claimed as executed because this workspace has no approved Cartesia production credentials, published agent, phone/audio route, consent record, or jurisdiction approval.

Before a real call:

1. Publish the Cartesia agent with `{{opencloser_context}}` in its prompt and the `request_human_handoff` client tool.
2. Store `cartesia_api_key` in OpenCloser's OS-keychain settings and set the non-secret Agent ID.
3. Use a sandbox/test lead with explicit consent.
4. Start the call manually in OpenCloser War Room.
5. For PSTN, use OpenCloser's existing Phone Link plus configured virtual-audio route. This release does not claim native Cartesia `/agents/calls` dialing.
6. Verify disclosure, permission, interruption, opt-out, handoff, transcript, and post-call logging.
