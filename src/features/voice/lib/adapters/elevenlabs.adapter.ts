// ============================================================
// ElevenLabs Conversational AI adapter.
//
// Protocol: the adapter opens the loopback relay and sends an
// ElevenLabs-specific config frame (API key + agent id). Audio is
// raw PCM16 in both directions; transcript/interruption events
// are translated by the Rust relay.
// ============================================================

import { getProviderKey } from "../../../../stores/keys.store";
import {
  CallerEngine,
  attachRelayHandlers,
  float32ToPcm16,
  openRelayConnection,
  relayPcmToBase64,
} from "./base";

export class ElevenLabsCallerEngine extends CallerEngine {
  private ws: WebSocket | null = null;

  async connect(systemPrompt: string, _voiceId: string, _language: string): Promise<void> {
    this.setState("connecting");

    const apiKey = await getProviderKey("elevenlabs_api_key");
    // The agent id is not a secret; it stays in regular settings storage.
    const agentId = localStorage.getItem("elevenlabs_agent_id")?.trim() || "";
    if (!apiKey || !agentId) {
      throw new Error("ElevenLabs API key and Agent ID required. Go to Settings → Voice Engine.");
    }

    const { ws, token } = await openRelayConnection("elevenlabs");
    this.ws = ws;

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        // ElevenLabs ConvAI handshake — provider-specific config frame.
        this.ws!.send(
          JSON.stringify({
            provider: "elevenlabs",
            apiKey,
            agentId,
            token,
            systemPrompt,
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
        onAudio: (pcm16) => this.callbacks.onAudio(relayPcmToBase64(pcm16), 24000),
      });

      this.ws!.onclose = () => this.setState("ended");
      this.ws!.onerror = () => {
        const err = new Error("ElevenLabs relay connection failed");
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
