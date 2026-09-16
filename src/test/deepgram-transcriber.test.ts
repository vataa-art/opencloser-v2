// Provider contract tests — Deepgram streaming transcriber over the
// local relay: key handling, config frame, PCM16 uplink, final transcripts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeepgramTranscriber, normalizeDeepgramLanguage } from "../features/voice/lib/deepgram";
import { useKeysStore } from "../stores/keys.store";
import { stubWebSocket, waitForSocket } from "./helpers/mock-ws";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "get_relay_port") return 41234;
    if (command === "get_relay_token") return "relay-token";
    return null;
  }),
}));

describe("Deepgram transcriber", () => {
  beforeEach(() => {
    localStorage.clear();
    stubWebSocket();
    useKeysStore.setState({ keys: { deepgram_api_key: "dg-test" }, hydrated: true });
  });

  it("throws a helpful error when no key is configured", async () => {
    useKeysStore.setState({ keys: {}, hydrated: true });
    const t = new DeepgramTranscriber({ onTranscript: () => {}, onError: () => {} });
    await expect(t.connect("en-US")).rejects.toThrow(/Deepgram API key not configured/);
  });

  it("sends the Deepgram config frame with key, language and relay token", async () => {
    const t = new DeepgramTranscriber({ onTranscript: () => {}, onError: () => {} });
    const ready = t.connect("uk");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    const config = ws.lastText();
    expect(config.provider).toBe("deepgram");
    expect(config.apiKey).toBe("dg-test");
    expect(config.language).toBe("uk");
    expect(config.model).toBe("nova-2");
    expect(config.token).toBe("relay-token");
  });

  it("forwards only final transcripts to onTranscript", async () => {
    const transcripts: string[] = [];
    const t = new DeepgramTranscriber({
      onTranscript: (text) => transcripts.push(text),
      onError: () => {},
    });
    const ready = t.connect("en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    ws.serverText({
      type: "Results",
      is_final: true,
      speech_final: true,
      channel: { alternatives: [{ transcript: "Tell me more" }] },
    });
    ws.serverText({
      type: "Results",
      is_final: false,
      channel: { alternatives: [{ transcript: "partial" }] },
    });

    expect(transcripts).toEqual(["Tell me more"]);
  });

  it("streams microphone audio as PCM16 and reports state", async () => {
    const t = new DeepgramTranscriber({ onTranscript: () => {}, onError: () => {} });
    const ready = t.connect("en-US");
    const ws = await waitForSocket();
    ws.open();
    ws.serverText({ type: "ready" });
    await ready;

    expect(t.isConnected()).toBe(true);

    t.sendAudio(new Float32Array([1, -1]));
    const binary = ws.sentBinary();
    expect(binary).toHaveLength(1);
    const samples = new Int16Array(binary[0]);
    expect(Array.from(samples)).toEqual([32767, -32768]);

    t.disconnect();
    expect(t.isConnected()).toBe(false);
    t.sendAudio(new Float32Array([1, -1]));
    expect(ws.sentBinary()).toHaveLength(1);
  });

  it("normalizes legacy language labels", () => {
    expect(normalizeDeepgramLanguage("Ukrainian")).toBe("uk");
    expect(normalizeDeepgramLanguage("en-US")).toBe("en-US");
  });
});
