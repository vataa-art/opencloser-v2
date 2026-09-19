// Provider contract tests — OpenAI Realtime adapter.
// Verifies the adapter's config-frame contract, audio framing, and
// internal event handling against the local relay protocol.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { OpenAICallerEngine } from "../features/voice/lib/adapters/openai.adapter";
import { createCallerEngine } from "../features/voice/lib/caller-engine";
import { useKeysStore } from "../stores/keys.store";
import { MockWebSocket, stubWebSocket, waitForSocket } from "./helpers/mock-ws";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "get_relay_port") return 41234;
    if (command === "get_relay_token") return "relay-token";
    return null;
  }),
}));

function presetKeys(): void {
  useKeysStore.setState({
    keys: { openai_api_key: "sk-test" },
    hydrated: true,
  });
}

const noopCallbacks = () => ({
  onState: vi.fn(),
  onAudio: vi.fn(),
  onTranscript: vi.fn(),
  onInterrupted: vi.fn(),
  onError: vi.fn(),
});

describe("OpenAI Realtime adapter", () => {
  beforeEach(() => {
    localStorage.clear();
    stubWebSocket();
    presetKeys();
  });

  it("sends an OpenAI-specific config frame with the relay token", async () => {
    const engine = new OpenAICallerEngine(noopCallbacks());
    const ready = engine.connect("You are an SDR", "nova", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const config = ws.lastText();
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("sk-test");
    expect(config.token).toBe("relay-token");
    expect(config.model).toBe("gpt-realtime-2.1");
    expect(config.voice).toBe("nova");
    expect(config.systemPrompt).toBe("You are an SDR");
    expect(ws.url).toContain("ws://127.0.0.1:41234?provider=openai");
  });

  it("resolves only after the relay reports ready", async () => {
    const callbacks = noopCallbacks();
    const engine = new OpenAICallerEngine(callbacks);
    const ready = engine.connect("prompt", "alloy", "en-US");
    const ws = await waitForSocket();
    ws.open();

    let resolved = false;
    ready.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);

    ws.serverText({ type: "ready" });
    await ready;
    expect(callbacks.onState).toHaveBeenCalledWith("active");
  });

  it("translates transcript events and binary PCM audio", async () => {
    const callbacks = noopCallbacks();
    const engine = new OpenAICallerEngine(callbacks);
    const ready = engine.connect("prompt", "alloy", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    ws.serverText({ type: "transcript.model", text: "Hello" });
    ws.serverText({ type: "transcript.user", text: "Hi" });
    ws.serverText({ type: "interrupted" });

    const samples = new Int16Array([1000, -1000]);
    ws.serverBinary(new Uint8Array(samples.buffer));

    expect(callbacks.onTranscript).toHaveBeenCalledTimes(2);
    expect(callbacks.onTranscript.mock.calls[0][0]).toMatchObject({ role: "model", text: "Hello" });
    expect(callbacks.onTranscript.mock.calls[1][0]).toMatchObject({ role: "user", text: "Hi" });
    expect(callbacks.onInterrupted).toHaveBeenCalledTimes(1);
    expect(callbacks.onAudio).toHaveBeenCalledTimes(1);
    const [b64, sampleRate] = callbacks.onAudio.mock.calls[0];
    expect(sampleRate).toBe(24000);
    const decoded = new Int16Array(Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0)).buffer);
    expect(Array.from(decoded)).toEqual([1000, -1000]);
  });

  it("surfaces relay error frames and rejects connect", async () => {
    const callbacks = noopCallbacks();
    const engine = new OpenAICallerEngine(callbacks);
    const ready = engine.connect("prompt", "alloy", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "error", message: "Unauthorized relay connection" });

    await expect(ready).rejects.toThrow("Unauthorized relay connection");
    expect(callbacks.onError).toHaveBeenCalled();
  });

  it("resamples 16 kHz microphone audio to 24 kHz PCM16 frames", async () => {
    const engine = new OpenAICallerEngine(noopCallbacks());
    const ready = engine.connect("prompt", "alloy", "en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    engine.sendAudio(new Float32Array([0.5, -0.5]));
    const binary = ws.sentBinary();
    expect(binary).toHaveLength(1);
    const samples = new Int16Array(binary[0]);
    expect(samples).toHaveLength(3);
    expect(samples[0]).toBeGreaterThan(16000);
    expect(samples[2]).toBeLessThan(-16000);
  });

  it("falls back to the demo engine when no key is configured", async () => {
    useKeysStore.setState({ keys: {}, hydrated: true });
    const { DemoCallerEngine } = await import("../features/voice/lib/adapters/demo.adapter");
    const engine = await createCallerEngine("openai", noopCallbacks());
    expect(engine).toBeInstanceOf(DemoCallerEngine);
    expect(invoke).toBeDefined();
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
