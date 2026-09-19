# Design — Cartesia Sonic brand seller

## Architecture

`War Room microphone (16 kHz Float32)` → `CartesiaCallerEngine` → `PCM16` → `authenticated loopback relay` → `Cartesia Managed Agent WebSocket`.

Return path:

`audio_output / turn_ended / audio_output_clear / error` → `Rust protocol translator` → `OpenCloser binary PCM / transcript / interrupted / error events` → `War Room playback, transcript, logging and QA`.

## Current API contract

- Endpoint: `wss://api.cartesia.ai/v1/agents/websocket/{agent_id}?cartesia_version=2026-08-14`
- Server auth: `X-API-Key` header.
- First event: `session_create` with `pcm_16000` and `speaking_pace`.
- Client audio: base64 `audio_input` JSON events.
- Server events: `session_ready`, `audio_output`, `audio_output_clear`, `turn_ended`, `error`.

## Runtime context

The published Cartesia agent owns the durable voice/model/tool configuration. OpenCloser passes its per-call prompt in the allowed dynamic variable `opencloser_context`. The Cartesia agent system prompt must include `{{opencloser_context}}` and the fixed safety policy documented in `docs/CARTESIA_INNIE_AGENT.md`.

## Security

- Secret: `cartesia_api_key` via OS keychain.
- Non-secret: `cartesia_agent_id` via local settings.
- WebView connects only to `127.0.0.1` with the per-launch relay token.
- Rust opens the authenticated provider socket; provider credentials never enter a remote browser origin.

## Failure handling

- Missing key/agent ID: adapter rejects before network access.
- Missing `session_ready`: relay handshake timeout.
- Fatal Cartesia error: normalized `error` event to adapter.
- Unknown events: ignored/passed without failing forward compatibility.
- Disconnect: engine enters `ended`; no audio is sent afterward.
