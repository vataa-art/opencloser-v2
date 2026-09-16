import { create } from "zustand";
import {
  AIPersona,
  DEFAULT_PERSONA,
  SalesFramework,
  VoicePreset,
  VOICE_PRESETS,
} from "../types/persona";
import { ProviderId } from "../features/voice/lib/providers";

interface PersonaState {
  persona: AIPersona;
  updateEmotion: (key: keyof AIPersona["emotionalModulation"], value: number | boolean) => void;
  updateSpeech: (key: keyof AIPersona["speechPatterns"], value: any) => void;
  applyPreset: (preset: VoicePreset) => void;
  setProvider: (provider: ProviderId) => void;
  setFramework: (framework: SalesFramework) => void;
  setVoiceId: (voiceId: string) => void;
  setLanguage: (language: string) => void;
  save: () => void;
  loadFromStorage: () => void;
}

function loadPersona(): AIPersona {
  try {
    const s = localStorage.getItem("ai_persona");
    if (s) return { ...DEFAULT_PERSONA, ...JSON.parse(s) };
  } catch {}
  return DEFAULT_PERSONA;
}

export const usePersonaStore = create<PersonaState>((set, get) => ({
  persona: loadPersona(),

  updateEmotion: (key, value) =>
    set((s) => ({
      persona: {
        ...s.persona,
        voicePreset: "Custom",
        emotionalModulation: {
          ...s.persona.emotionalModulation,
          [key]: value,
        },
      },
    })),

  updateSpeech: (key, value) =>
    set((s) => ({
      persona: {
        ...s.persona,
        speechPatterns: { ...s.persona.speechPatterns, [key]: value },
      },
    })),

  applyPreset: (preset) => {
    if (preset === "Custom") return;
    const overrides = VOICE_PRESETS[preset];
    set((s) => ({
      persona: {
        ...s.persona,
        voicePreset: preset,
        emotionalModulation: {
          ...s.persona.emotionalModulation,
          ...overrides,
        },
      },
    }));
  },

  setProvider: (provider) =>
    set((s) => ({
      persona: { ...s.persona, provider },
    })),

  setFramework: (framework) =>
    set((s) => ({
      persona: { ...s.persona, framework },
    })),

  setVoiceId: (voiceId) =>
    set((s) => ({
      persona: { ...s.persona, voiceId },
    })),

  setLanguage: (language) =>
    set((s) => ({
      persona: { ...s.persona, language },
    })),

  save: () => {
    try {
      localStorage.setItem("ai_persona", JSON.stringify(get().persona));
    } catch {}
  },

  loadFromStorage: () => {
    set({ persona: loadPersona() });
  },
}));
