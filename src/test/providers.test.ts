import { describe, it, expect } from "vitest";
import { PROVIDERS, getProvider, getApiKey, hasApiKey } from "../features/voice/lib/providers";

describe("providers", () => {
  it("has three providers", () => {
    expect(PROVIDERS).toHaveLength(3);
    expect(PROVIDERS.map((p) => p.id)).toEqual(["gemini", "openai", "elevenlabs"]);
  });

  it("getProvider returns correct config", () => {
    const g = getProvider("gemini");
    expect(g.id).toBe("gemini");
    expect(g.requiresRelay).toBe(false);
    expect(g.voices.length).toBeGreaterThan(0);
  });

  it("getProvider defaults to gemini for unknown", () => {
    const p = getProvider("unknown" as any);
    expect(p.id).toBe("gemini");
  });

  it("openai requires relay", () => {
    const o = getProvider("openai");
    expect(o.requiresRelay).toBe(true);
  });

  it("elevenlabs has extra settings", () => {
    const e = getProvider("elevenlabs");
    expect(e.extraSettings).toBeDefined();
    expect(e.extraSettings!.length).toBeGreaterThan(0);
  });

  it("all providers have apiKeySettingKey", () => {
    PROVIDERS.forEach((p) => {
      expect(p.apiKeySettingKey).toBeTruthy();
      expect(p.apiKeyLabel).toBeTruthy();
    });
  });

  it("hasApiKey returns false when not set", () => {
    expect(hasApiKey("gemini")).toBe(false);
  });

  it("getApiKey returns empty when not set", () => {
    expect(getApiKey("gemini")).toBe("");
  });
});
