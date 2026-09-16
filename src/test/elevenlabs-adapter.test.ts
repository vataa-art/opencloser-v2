// Provider contract tests — ElevenLabs ConvAI adapter.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsCallerEngine } from "../features/voice/lib/adapters/elevenlabs.adapter";
import { useKeysStore } from "../stores/keys.store";
import { MockWebSocket, stubWebSocket, waitForSocket } from "./helpers/mock-ws";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "get_relay_port") return 41234;
    if (command === "get_relay_token") return "relay-token";
    return null;
  }),
}));

const noopCallbacks = () => ({
  onState: vi.fn(),
  onAudio: vi.fn(),
  onTranscript: vi.fn(),
  onInterrupted: vi.fn(),
  onError: vi.fn(),
});

describe("ElevenLabs ConvAI adapter", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("elevenlabs_agent_id", "agent_test123");
    stubWebSocket();
    useKeysStore.setState({ keys: { elevenlabs_api_key: "xi-test" }, hydrated: true });
  });

  it("requires both an API key and an agent id", async () => {
    const engine = new ElevenLabsCallerEngine(noopCallbacks());
    localStorage.removeItem("elevenlabs_agent_id");
    await expect(engine.connect("prompt", "rachel", "en-US")).rejects.toThrow(/Agent ID/);
  });

  it("sends an ElevenLabs-specific config frame including the agent id", async () => {
    const engine = new ElevenLabsCallerEngine(noopCallbacks());
    const ready = engine.connect("You are an SDR", "rachel", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const config = ws.lastText();
    expect(config.provider).toBe("elevenlabs");
    expect(config.apiKey).toBe("xi-test");
    expect(config.agentId).toBe("agent_test123");
    expect(config.token).toBe("relay-token");
    expect(config.systemPrompt).toBe("You are an SDR");
    expect(ws.url).toContain("provider=elevenlabs");
  });

  it("delivers binary PCM audio and interruption events", async () => {
    const callbacks = noopCallbacks();
    const engine = new ElevenLabsCallerEngine(callbacks);
    const ready = engine.connect("prompt", "rachel", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const samples = new Int16Array([12345, -12345]);
    ws.serverBinary(new Uint8Array(samples.buffer));
    ws.serverText({ type: "interrupted" });
    ws.serverText({ type: "transcript.model", text: "Absolutely" });

    expect(callbacks.onAudio).toHaveBeenCalledTimes(1);
    const [b64, sampleRate] = callbacks.onAudio.mock.calls[0];
    expect(sampleRate).toBe(24000);
    const decoded = new Int16Array(Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0)).buffer);
    expect(Array.from(decoded)).toEqual([12345, -12345]);
    expect(callbacks.onInterrupted).toHaveBeenCalledTimes(1);
    expect(callbacks.onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ role: "model", text: "Absolutely" })
    );
  });

  it("stops streaming after disconnect", async () => {
    const callbacks = noopCallbacks();
    const engine = new ElevenLabsCallerEngine(callbacks);
    const ready = engine.connect("prompt", "rachel", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    engine.disconnect();
    const sendCount = ws.sent.length;
    engine.sendAudio(new Float32Array([0.5, -0.5]));
    expect(ws.sent.length).toBe(sendCount);
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
