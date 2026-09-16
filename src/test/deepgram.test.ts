import { describe, expect, it } from "vitest";
import {
  DEEPGRAM_LANGUAGES,
  normalizeDeepgramLanguage,
  parseDeepgramMessage,
} from "../features/voice/lib/deepgram";

describe("Deepgram transcription", () => {
  it("offers the two supported call languages", () => {
    expect(DEEPGRAM_LANGUAGES.map((item) => item.value)).toEqual(["en-US", "uk"]);
  });

  it("normalizes legacy persona labels to Deepgram language codes", () => {
    expect(normalizeDeepgramLanguage("Українська")).toBe("uk");
    expect(normalizeDeepgramLanguage("uk")).toBe("uk");
    expect(normalizeDeepgramLanguage("English (US) - Conversational")).toBe("en-US");
    expect(normalizeDeepgramLanguage(undefined)).toBe("en-US");
  });

  it("parses final Results messages and ignores non-results", () => {
    const result = parseDeepgramMessage(JSON.stringify({
      type: "Results",
      is_final: true,
      speech_final: true,
      channel: { alternatives: [{ transcript: "Добрий день" }] },
    }));
    expect(result).toEqual({ text: "Добрий день", isFinal: true, speechFinal: true });
    expect(parseDeepgramMessage(JSON.stringify({ type: "Metadata" }))).toBeNull();
  });

  it("does not manufacture text from malformed or empty messages", () => {
    expect(parseDeepgramMessage("not-json")).toBeNull();
    expect(parseDeepgramMessage(JSON.stringify({
      type: "Results",
      is_final: false,
      channel: { alternatives: [{ transcript: "   " }] },
    }))).toBeNull();
  });
});
