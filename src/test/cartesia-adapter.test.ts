// Provider contract tests — Cartesia Managed Agents (Sonic voice pipeline).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartesiaCallerEngine } from "../features/voice/lib/adapters/cartesia.adapter";
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
  onHandoffRequested: vi.fn(),
  onError: vi.fn(),
});

describe("Cartesia Managed Agent adapter", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("cartesia_agent_id", "agent_test123");
    stubWebSocket();
    useKeysStore.setState({ keys: { cartesia_api_key: "sk_car_test" }, hydrated: true });
  });

  it("requires both an API key and an agent id", async () => {
    const engine = new CartesiaCallerEngine(noopCallbacks());
    localStorage.removeItem("cartesia_agent_id");
    await expect(engine.connect("prompt", "managed", "uk")).rejects.toThrow(/Agent ID/);
  });

  it("sends provider config with the OpenCloser per-call context", async () => {
    const engine = new CartesiaCallerEngine(noopCallbacks());
    const ready = engine.connect("You represent innie.pro", "managed", "uk");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const config = ws.lastText();
    expect(config.provider).toBe("cartesia");
    expect(config.apiKey).toBe("sk_car_test");
    expect(config.agentId).toBe("agent_test123");
    expect(config.token).toBe("relay-token");
    expect(config.systemPrompt).toBe("You represent innie.pro");
    expect(config.language).toBe("uk");
    expect(ws.url).toContain("provider=cartesia");
  });

  it("delivers 16 kHz PCM audio, final turns, and interruption events", async () => {
    const callbacks = noopCallbacks();
    const engine = new CartesiaCallerEngine(callbacks);
    const ready = engine.connect("prompt", "managed", "uk");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const samples = new Int16Array([12345, -12345]);
    ws.serverBinary(new Uint8Array(samples.buffer));
    ws.serverText({ type: "interrupted" });
    ws.serverText({ type: "transcript.model", text: "Домовились" });
    ws.serverText({ type: "transcript.user", text: "Передзвоніть завтра" });

    expect(callbacks.onAudio).toHaveBeenCalledTimes(1);
    const [b64, sampleRate] = callbacks.onAudio.mock.calls[0];
    expect(sampleRate).toBe(16000);
    const decoded = new Int16Array(Uint8Array.from(atob(b64 as string), (c) => c.charCodeAt(0)).buffer);
    expect(Array.from(decoded)).toEqual([12345, -12345]);
    expect(callbacks.onInterrupted).toHaveBeenCalledTimes(1);
    expect(callbacks.onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ role: "model", text: "Домовились" })
    );
    expect(callbacks.onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", text: "Передзвоніть завтра" })
    );
  });

  it("stops sending audio after disconnect", async () => {
    const engine = new CartesiaCallerEngine(noopCallbacks());
    const ready = engine.connect("prompt", "managed", "uk");
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

  it("records a human handoff request and acknowledges the client tool", async () => {
    const callbacks = noopCallbacks();
    const engine = new CartesiaCallerEngine(callbacks);
    const ready = engine.connect("prompt", "managed", "uk");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    ws.serverText({
      type: "handoff.requested",
      toolCallId: "tool_123",
      reason: "Prospect wants pricing from Roman",
      expectsResponse: true,
    });

    expect(callbacks.onHandoffRequested).toHaveBeenCalledWith("Prospect wants pricing from Roman");
    expect(ws.lastText()).toEqual(expect.objectContaining({
      type: "client_tool_result",
      tool_call_id: "tool_123",
      is_error: false,
    }));
  });
});
