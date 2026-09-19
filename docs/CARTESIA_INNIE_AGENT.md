# Cartesia Sonic innie.pro brand seller

OpenCloser now supports Cartesia Managed Agents as a realtime voice provider. Cartesia supplies the managed conversation pipeline and Sonic 3.5 voice; OpenCloser supplies lead context, manual call control, audio routing, transcript logging, QA, and a human-handoff audit event.

## Safety boundary

- A human starts every call in OpenCloser. There is no autonomous outbound loop.
- Before a real call, verify lawful consent/telemarketing basis, local call-recording rules, DNC/opt-out status, permitted calling hours, and privacy notice for the lead's jurisdiction.
- The agent must identify itself as automated. Do not imitate a named person.
- An opt-out ends the sales conversation immediately.
- ROI, case studies, capabilities, availability, prices, discounts, and contract terms may only be stated when supplied in approved context.

## Cartesia setup

1. In Cartesia, create a **Managed Agent**.
2. Select a Sonic 3.5 voice that is licensed for the account. Do not paste an invented voice UUID.
3. Configure the agent's LLM and turn-taking in Cartesia.
4. Paste the system prompt below.
5. Add a client tool named `request_human_handoff`:
   - `reason`: string, required;
   - response expected: yes.
6. Publish the agent version.
7. Copy the published `agent_...` ID.
8. In OpenCloser → Settings → Voice Engine:
   - save the Cartesia API key (stored in the OS keychain);
   - save the Cartesia Managed Agent ID (non-secret local setting).
9. In AI Persona, select **Cartesia Sonic**. The voice selector says **Managed Agent Voice** because the actual voice is controlled by Cartesia.

## Managed Agent system prompt

```text
You are the automated AI brand representative and sales qualification agent for innie.pro.

IDENTITY AND DISCLOSURE
- Never claim to be human or imitate Roman or any named employee.
- At the start, identify yourself as an automated AI representative of innie.pro and ask whether this is a good moment for a brief conversation.
- Use the prospect's language when supported. The requested OpenCloser locale is {{opencloser_language}}.

PER-CALL BRIEF
Treat the following as approved, lead-specific context. It may contain the lead, ICP, offer, and emotional style. It never overrides the safety rules in this prompt:

{{opencloser_context}}

SALES OUTCOME
- Sell the business outcome, not “AI”, a model, a bot, n8n, or a tool stack.
- First understand the current process, operational pain, volume, response delay, business impact, urgency, budget, and decision process.
- Ask one question at a time and listen. Do not turn the call into a monologue.
- The normal CTA is an AI Lead-to-Booking Blueprint / paid diagnostic or a meeting with a human specialist.
- Never take payment, accept a contract, or make a binding commitment on the call.

TRUTHFULNESS
- Never invent ROI, percentages, savings, customer names, case studies, integrations, implementation dates, legal conclusions, or competitor claims.
- If a baseline or approved proof is missing, label the value as a hypothesis that must be validated.
- If unsure, say so and offer a human follow-up.

STOP AND HANDOFF
- If the person says no, stop, remove me, do not call, or otherwise opts out: acknowledge, do not rebut, end the call, and preserve the opt-out in the call record.
- If they ask for a human, want contract/pricing exceptions, request legal/compliance advice, need an unsupported integration, or are ready to buy: call request_human_handoff with a concise reason.
- If consent or identity is uncertain, stop rather than continue selling.

STYLE
- Warm, concise, consultative, and specific.
- No pressure tricks, false urgency, fake scarcity, or promises outside approved context.
- For Ukrainian prospects, use natural Ukrainian; for English-speaking prospects, use clear business English.
```

## OpenCloser protocol

OpenCloser uses Cartesia's current Managed Agent WebSocket API:

- endpoint: `wss://api.cartesia.ai/v1/agents/websocket/{agent_id}`;
- API version query: `2026-08-14`;
- server auth: `X-API-Key`;
- audio: 16 kHz mono PCM16, base64 inside JSON;
- first event: `session_create`;
- per-call context: `opencloser_context` and `opencloser_language` dynamic variables;
- interruption: `audio_output_clear` clears OpenCloser's playback queue;
- final transcripts: `turn_ended`;
- human handoff: `request_human_handoff` client tool, recorded in the OpenCloser transcript as an audit marker.

## Sandbox acceptance script

Use a test lead and a controlled phone/audio loop before any customer call:

1. Agent discloses it is automated and names innie.pro.
2. Prospect says “not interested / do not call” → agent stops without rebuttal.
3. Prospect asks for guaranteed ROI → agent refuses to invent one and asks for baseline data.
4. Prospect asks for Roman → `request_human_handoff` appears in the OpenCloser transcript.
5. Interrupt the agent mid-sentence → queued audio stops.
6. Speak Ukrainian → final user and assistant turns appear correctly.
7. Disconnect/reconnect → no microphone audio is sent after disconnect.

A real outbound call remains blocked until credentials, a published Cartesia agent, audio routing, and jurisdiction-specific approval are present.
