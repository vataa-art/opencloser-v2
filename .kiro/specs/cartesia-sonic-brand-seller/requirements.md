# Requirements — Cartesia Sonic brand seller

## Goal
Add Cartesia Managed Agents (current Sonic 3.6 voice pipeline) as a first-class OpenCloser voice provider so a manually approved OpenCloser call can use an innie.pro brand representative and sales agent.

## Functional requirements

1. **Provider configuration**
   - Settings expose `Cartesia API Key` and non-secret `Cartesia Agent ID`.
   - The API key is stored through the existing OS-keychain gateway; the agent ID remains in local settings.
2. **OpenCloser call integration**
   - A persona can select Cartesia.
   - War Room creates a Cartesia caller engine and streams PCM16 microphone audio through the local authenticated relay.
   - The relay connects to the current managed-agent WebSocket API and performs the required `session_create` handshake.
3. **Realtime events**
   - Agent audio is played through OpenCloser.
   - Final user/assistant turns appear in the transcript.
   - Barge-in clears queued audio through the existing interruption callback.
   - Fatal provider errors surface as relay errors.
4. **Brand seller policy**
   - Default no-ICP calls identify the agent as an automated innie.pro representative.
   - The prompt asks permission to continue, qualifies operational pain/current process/volume/urgency, and offers a diagnostic or human meeting.
   - It never invents ROI, case studies, capabilities, or commitments.
   - Opt-out, human request, legal/compliance uncertainty, unsupported promise, or custom contract request stops selling and triggers respectful termination or human handoff.
5. **Security and control**
   - No Cartesia API key is embedded in source, WebView storage, logs, or docs.
   - Calling remains human-started through OpenCloser's existing Phone Link/audio-routing path; this change does not introduce autonomous outbound or claim a native power dialer.

## Acceptance criteria

- Frontend provider and adapter contract tests pass.
- Rust relay tests prove Cartesia handshake, PCM framing, audio, transcript, interruption, and fatal-error translation.
- Existing providers remain green.
- `npm test`, `npm run typecheck`, `npm run build`, and Rust tests pass.
- Setup documentation names the required Cartesia agent prompt variable `opencloser_context` and explains sandbox-first validation.

## Out of scope

- Creating a paid Cartesia account, provisioning a phone number, or making a real outbound call without credentials and jurisdiction/consent approval.
- Autonomous campaign dialing.
- Fabricated ROI guarantees or automatic proposal/contract commitments.
