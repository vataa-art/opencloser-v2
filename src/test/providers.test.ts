import { describe, it, expect } from "vitest";
import { PROVIDERS, getProvider, getApiKey, hasApiKey } from "../features/voice/lib/providers";

describe("providers", () => {
  it("has four providers", () => {
    expect(PROVIDERS).toHaveLength(4);
    expect(PROVIDERS.map((p) => p.id)).toEqual(["gemini", "openai", "elevenlabs", "cartesia"]);
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

  it("uses current live provider models", () => {
    expect(getProvider("gemini").model).toBe("gemini-3.8-live");
    expect(getProvider("openai").model).toBe("gpt-realtime-2.1");
  });

  it("managed-agent providers expose agent ID settings", () => {
    for (const id of ["elevenlabs", "cartesia"] as const) {
      const provider = getProvider(id);
      expect(provider.extraSettings).toBeDefined();
      expect(provider.extraSettings!.some((setting) => setting.key === `${id}_agent_id`)).toBe(true);
    }
  });

  it("uses Cartesia's current Sonic model", () => {
    expect(getProvider("cartesia").model).toBe("sonic-3.6");
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
