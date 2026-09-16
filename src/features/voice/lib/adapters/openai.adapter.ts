// ============================================================
// OpenAI Realtime adapter.
//
// Protocol: the adapter opens the loopback relay, sends an
// OpenAI-specific config frame (model/voice/system prompt), then
// streams raw PCM16. Provider events are translated into the
// internal event format by the Rust relay before reaching
// attachRelayHandlers.
// ============================================================

import { getProviderKey } from "../../../../stores/keys.store";
import {
  CallerEngine,
  attachRelayHandlers,
  float32ToPcm16,
  openRelayConnection,
  relayPcmToBase64,
} from "./base";

const OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview";

export class OpenAICallerEngine extends CallerEngine {
  private ws: WebSocket | null = null;

  async connect(systemPrompt: string, voiceId: string, _language: string): Promise<void> {
    this.setState("connecting");

    const apiKey = await getProviderKey("openai_api_key");
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Go to Settings → Voice Engine.");
    }

    const { ws, token } = await openRelayConnection("openai");
    this.ws = ws;

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        // OpenAI Realtime handshake — provider-specific config frame.
        this.ws!.send(
          JSON.stringify({
            provider: "openai",
            apiKey,
            token,
            model: OPENAI_REALTIME_MODEL,
            voice: voiceId,
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
        const err = new Error("OpenAI relay connection failed");
        this.callbacks.onError(err);
        reject(err);
      };
    });
  }

  sendAudio(float32: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // OpenAI expects raw PCM16 frames; the relay wraps them into
    // input_audio_buffer.append events server-side.
    this.ws.send(float32ToPcm16(float32));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.setState("ended");
  }
}
