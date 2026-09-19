// ============================================================
// Gemini Live adapter — Google's native realtime audio model.
// Connects directly from the WebView (no relay); API key is
// loaded from the keys store (OS keychain), not localStorage.
// ============================================================

import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { getProviderKey } from "../../../../stores/keys.store";
import { CallerEngine, type EngineCallbacks } from "./base";

const GEMINI_LIVE_MODEL = "gemini-3.8-live";

export class GeminiCallerEngine extends CallerEngine {
  private session: any = null;
  private sessionPromise: Promise<any> | null = null;

  constructor(callbacks: EngineCallbacks) {
    super(callbacks);
  }

  async connect(systemPrompt: string, voiceId: string, _language: string): Promise<void> {
    this.setState("connecting");

    const apiKey = await getProviderKey("gemini_api_key");
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Go to Settings → Voice Engine.");
    }

    const ai = new GoogleGenAI({ apiKey });

    this.sessionPromise = ai.live.connect({
      model: GEMINI_LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } },
        },
        systemInstruction: systemPrompt,
        // @ts-ignore inputAudioTranscription is not in the published types yet
        inputAudioTranscription: {},
        // @ts-ignore outputAudioTranscription is not in the published types yet
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.setState("active");
        },
        onmessage: (message: LiveServerMessage) => {
          // Handle audio
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            this.callbacks.onAudio(base64Audio, 24000);
          }

          // Handle interruption
          if (message.serverContent?.interrupted) {
            this.callbacks.onInterrupted();
          }

          // Handle transcript — model output
          const outputTranscript = (message as any).serverContent?.outputTranscription?.text;
          if (outputTranscript) {
            this.callbacks.onTranscript(this.makeTranscriptLine("model", outputTranscript));
          }

          // Handle transcript — user input
          const inputTranscript = (message as any).serverContent?.inputTranscription?.text;
          if (inputTranscript) {
            this.callbacks.onTranscript(this.makeTranscriptLine("user", inputTranscript));
          }

          // Fallback: model turn text parts
          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
          if (textPart && !outputTranscript) {
            this.callbacks.onTranscript(this.makeTranscriptLine("model", textPart));
          }
        },
        onclose: () => {
          this.setState("ended");
        },
        onerror: (err: any) => {
          this.callbacks.onError(new Error(err?.message || "Gemini connection error"));
          this.setState("ended");
        },
      },
    });

    this.session = await this.sessionPromise;
  }

  sendAudio(float32: Float32Array): void {
    if (!this.session) return;

    // Convert Float32 → Int16 → Base64
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    this.session.sendRealtimeInput({
      media: { data: b64, mimeType: "audio/pcm;rate=16000" },
    });
  }

  disconnect(): void {
    try {
      if (this.session && typeof this.session.close === "function") {
        this.session.close();
      }
    } catch {
      // Session may already be closed by the provider.
    }
    this.setState("ended");
  }
}
