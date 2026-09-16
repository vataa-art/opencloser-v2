// ============================================================
// Adapter base — shared call engine contract, PCM helpers, and
// the local relay event protocol (ready/transcript/interrupt).
// Each provider adapter owns its own config frame and framing;
// nothing here is a generic passthrough.
// ============================================================

import { invoke } from "@tauri-apps/api/core";

export type CallState =
  | "idle"
  | "connecting"
  | "active"
  | "objection_mode"
  | "closing"
  | "ended";

export interface TranscriptLine {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
}

export interface EngineCallbacks {
  onState: (state: CallState) => void;
  onAudio: (pcm16Base64: string, sampleRate: number) => void;
  onTranscript: (line: TranscriptLine) => void;
  onInterrupted: () => void;
  onError: (err: Error) => void;
}

export abstract class CallerEngine {
  protected callbacks: EngineCallbacks;
  protected state: CallState = "idle";

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  abstract connect(systemPrompt: string, voiceId: string, language: string): Promise<void>;
  abstract sendAudio(float32: Float32Array): void;
  abstract disconnect(): void;

  protected setState(s: CallState) {
    this.state = s;
    this.callbacks.onState(s);
  }

  protected makeTranscriptLine(role: "user" | "model", text: string): TranscriptLine {
    return { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() };
  }
}

// ── PCM / base64 helpers ────────────────────────────────────

export function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm16.buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function pcm16ToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

/** Convert a relay PCM16 frame into the base64 form of onAudio(). */
export function relayPcmToBase64(buffer: ArrayBuffer): string {
  const int16 = new Int16Array(buffer);
  const bytes = new Uint8Array(int16.buffer);
  return bytesToBase64(bytes);
}

// ── Local relay plumbing ────────────────────────────────────

export interface RelayConnection {
  ws: WebSocket;
  token: string;
}

/**
 * Open a WebSocket to the loopback voice relay. The API key is sent only in
 * the adapter's config frame — never in a URL — and the per-launch token
 * gates the socket against other local processes.
 */
export async function openRelayConnection(provider: string): Promise<RelayConnection> {
  const port: number = await invoke("get_relay_port");
  const token: string = await invoke("get_relay_token");
  const ws = new WebSocket(`ws://127.0.0.1:${port}?provider=${provider}`);
  ws.binaryType = "arraybuffer";
  return { ws, token };
}

export interface RelayFrameHandlers {
  onReady: () => void;
  onError: (message: string) => void;
  onTranscript: (role: "user" | "model", text: string) => void;
  onInterrupted: () => void;
  onAudio: (pcm16: ArrayBuffer) => void;
}

/**
 * Attach the internal relay event protocol to an open socket.
 * Provider-specific frames are translated by the Rust relay before they
 * reach here, so this layer only knows the internal event names.
 */
export function attachRelayHandlers(ws: WebSocket, handlers: RelayFrameHandlers): void {
  ws.onmessage = (event) => {
    if (typeof event.data === "string") {
      let msg: { type?: string; text?: string; message?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "ready":
          handlers.onReady();
          break;
        case "transcript.model":
          handlers.onTranscript("model", msg.text ?? "");
          break;
        case "transcript.user":
          handlers.onTranscript("user", msg.text ?? "");
          break;
        case "interrupted":
          handlers.onInterrupted();
          break;
        case "error":
          handlers.onError(msg.message || "Voice relay error");
          break;
        default:
          break;
      }
      return;
    }
    if (event.data instanceof ArrayBuffer) {
      handlers.onAudio(event.data);
    }
  };
}
