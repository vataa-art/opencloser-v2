import { invoke } from "@tauri-apps/api/core";
import { getProviderKey } from "../../../stores/keys.store";

export type DeepgramLanguage = "uk" | "en-US";

export const DEEPGRAM_LANGUAGES: Array<{ value: DeepgramLanguage; label: string }> = [
  { value: "en-US", label: "English (US)" },
  { value: "uk", label: "Українська" },
];

export function normalizeDeepgramLanguage(language: string | null | undefined): DeepgramLanguage {
  const value = (language || "").trim().toLowerCase();
  if (value === "uk" || value.startsWith("ukrain") || value.startsWith("україн")) return "uk";
  return "en-US";
}

export interface DeepgramTranscriptEvent {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
}

/** Parse one Deepgram Listen WebSocket message. Empty/interim text is ignored by callers. */
export function parseDeepgramMessage(payload: string): DeepgramTranscriptEvent | null {
  try {
    const message = JSON.parse(payload) as {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: Array<{ transcript?: string }> };
    };
    if (message.type !== "Results") return null;
    const text = message.channel?.alternatives?.[0]?.transcript?.trim() || "";
    if (!text) return null;
    return {
      text,
      isFinal: message.is_final === true,
      speechFinal: message.speech_final === true,
    };
  } catch {
    return null;
  }
}

function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm16.buffer;
}

export interface DeepgramTranscriberCallbacks {
  onTranscript: (text: string) => void;
  onError: (error: Error) => void;
}

/**
 * Deepgram streaming STT over the local Tauri relay. The API key is sent only
 * to the local relay's first frame, never placed in a public WebSocket URL.
 */
export class DeepgramTranscriber {
  private ws: WebSocket | null = null;
  private callbacks: DeepgramTranscriberCallbacks;
  private connected = false;

  constructor(callbacks: DeepgramTranscriberCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(language: DeepgramLanguage): Promise<void> {
    const apiKey = (await getProviderKey("deepgram_api_key")).trim();
    if (!apiKey) throw new Error("Deepgram API key not configured. Go to Settings → Speech-to-Text.");

    const port: number = await invoke("get_relay_port");
    const token: string = await invoke("get_relay_token");
    this.ws = new WebSocket(`ws://127.0.0.1:${port}?provider=deepgram`);
    this.ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: Error) => {
        this.callbacks.onError(error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      this.ws!.onopen = () => {
        this.ws!.send(JSON.stringify({
          provider: "deepgram",
          apiKey,
          language,
          model: "nova-2",
          token,
        }));
      };

      this.ws!.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let message: { type?: string; message?: string };
        try {
          message = JSON.parse(event.data) as { type?: string; message?: string };
        } catch {
          return;
        }
        if (message.type === "ready") {
          if (!settled) {
            settled = true;
            this.connected = true;
            resolve();
          }
          return;
        }
        if (message.type === "error") {
          fail(new Error(message.message || "Deepgram relay connection failed"));
          return;
        }
        const result = parseDeepgramMessage(event.data);
        if (result?.isFinal) this.callbacks.onTranscript(result.text);
      };

      this.ws!.onerror = () => fail(new Error("Deepgram relay connection failed"));
      this.ws!.onclose = () => {
        this.connected = false;
        if (!settled) fail(new Error("Deepgram relay closed before ready"));
      };
    });
  }

  sendAudio(float32: Float32Array): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(float32ToPcm16(float32));
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.connected = false;
    this.ws?.close();
    this.ws = null;
  }
}
