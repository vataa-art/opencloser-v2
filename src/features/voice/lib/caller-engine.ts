// ============================================================
// CallerEngine — multi-provider AI call gateway.
//
// This module is the single entry point for starting AI calls.
// Provider-specific protocol handling lives in ./adapters/*:
// one file per provider (Gemini Live, OpenAI Realtime, ElevenLabs
// ConvAI, plus an offline Demo engine). When no API key is
// configured for the selected provider, the factory falls back
// to the clearly-labelled Demo engine.
// ============================================================

import type { CallerEngine, EngineCallbacks } from "./adapters/base";
import { GeminiCallerEngine } from "./adapters/gemini.adapter";
import { OpenAICallerEngine } from "./adapters/openai.adapter";
import { ElevenLabsCallerEngine } from "./adapters/elevenlabs.adapter";
import { DemoCallerEngine } from "./adapters/demo.adapter";
import { getProviderKey } from "../../../stores/keys.store";

export type { CallState, TranscriptLine, EngineCallbacks } from "./adapters/base";
export { CallerEngine } from "./adapters/base";
export { GeminiCallerEngine, OpenAICallerEngine, ElevenLabsCallerEngine, DemoCallerEngine };

export type VoiceProvider = "gemini" | "openai" | "elevenlabs";

export async function createCallerEngine(
  provider: VoiceProvider,
  callbacks: EngineCallbacks
): Promise<CallerEngine> {
  const apiKey = await getProviderKey(`${provider}_api_key`);
  if (!apiKey) {
    console.warn(`No API key found for ${provider}. Falling back to Demo Mode.`);
    return new DemoCallerEngine(callbacks);
  }

  switch (provider) {
    case "gemini":
      return new GeminiCallerEngine(callbacks);
    case "openai":
      return new OpenAICallerEngine(callbacks);
    case "elevenlabs":
      return new ElevenLabsCallerEngine(callbacks);
    default:
      return new GeminiCallerEngine(callbacks);
  }
}
