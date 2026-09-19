// ============================================================
// Cartesia Managed Agents adapter — Sonic voice pipeline.
//
// The WebView talks only to OpenCloser's authenticated loopback
// relay. Rust owns the Cartesia server connection, API-key header,
// session_create handshake, and JSON/base64 protocol translation.
// ============================================================

import { getProviderKey } from "../../../../stores/keys.store";
import {
  CallerEngine,
  attachRelayHandlers,
  float32ToPcm16,
  openRelayConnection,
  relayPcmToBase64,
} from "./base";

const CARTESIA_SAMPLE_RATE = 16000;

export class CartesiaCallerEngine extends CallerEngine {
  private ws: WebSocket | null = null;

  async connect(systemPrompt: string, _voiceId: string, language: string): Promise<void> {
    this.setState("connecting");

    const apiKey = await getProviderKey("cartesia_api_key");
    const agentId = localStorage.getItem("cartesia_agent_id")?.trim() || "";
    if (!apiKey || !agentId) {
      throw new Error("Cartesia API key and Agent ID required. Go to Settings → Voice Engine.");
    }

    const { ws, token } = await openRelayConnection("cartesia");
    this.ws = ws;

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.ws!.send(
          JSON.stringify({
            provider: "cartesia",
            apiKey,
            agentId,
            token,
            systemPrompt,
            language,
          })
        );
      };

      attachRelayHandlers(this.ws!, {
        onReady: () => {
          this.setState("active");
          resolve();
        },
        onError: (message) => {
          const err = new Error(message);
          this.callbacks.onError(err);
          reject(err);
        },
        onTranscript: (role, text) => this.callbacks.onTranscript(this.makeTranscriptLine(role, text)),
        onInterrupted: () => this.callbacks.onInterrupted(),
        onAudio: (pcm16) => this.callbacks.onAudio(relayPcmToBase64(pcm16), CARTESIA_SAMPLE_RATE),
        onHandoffRequested: (toolCallId, reason, expectsResponse) => {
          this.callbacks.onHandoffRequested?.(reason);
          if (expectsResponse && toolCallId && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: "client_tool_result",
              tool_call_id: toolCallId,
              result: "Human handoff requested in OpenCloser. End the automated sales conversation politely.",
              is_error: false,
            }));
          }
        },
      });

      this.ws!.onclose = () => this.setState("ended");
      this.ws!.onerror = () => {
        const err = new Error("Cartesia relay connection failed");
        this.callbacks.onError(err);
        reject(err);
      };
    });
  }

  sendAudio(float32: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(float32ToPcm16(float32));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.setState("ended");
  }
}
