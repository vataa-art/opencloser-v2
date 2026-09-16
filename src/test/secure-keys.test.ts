// Contract tests for the secure key layer: keychain round-trip via Tauri
// commands, legacy localStorage migration, and sync store accessors.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSecret,
  getSecret,
  migrateLegacySecrets,
  setSecret,
} from "../services/secure-keys";
import {
  getStoredKey,
  hasAnyProviderKey,
  useKeysStore,
} from "../stores/keys.store";

const keychain = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string, args?: Record<string, unknown>) => {
    const name = String(args?.name);
    if (command === "secret_get") {
      return keychain.get(name) ?? null;
    }
    if (command === "secret_set") {
      // Mirrors the Rust command: an empty value deletes the entry.
      const value = String(args?.value);
      if (value === "") keychain.delete(name);
      else keychain.set(name, value);
      return null;
    }
    if (command === "secret_delete") {
      keychain.delete(name);
      return null;
    }
    return null;
  }),
}));

function enterDesktopMode(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

describe("secure keys", () => {
  beforeEach(() => {
    localStorage.clear();
    keychain.clear();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    useKeysStore.setState({ keys: {}, hydrated: false });
  });

  it("stores secrets in memory when not running inside Tauri", async () => {
    await setSecret("gemini_api_key", "in-memory");
    expect(await getSecret("gemini_api_key")).toBe("in-memory");
    expect(keychain.size).toBe(0);
  });

  it("round-trips secrets through keychain commands in desktop mode", async () => {
    enterDesktopMode();
    await setSecret("gemini_api_key", "keychain-value");
    expect(keychain.get("gemini_api_key")).toBe("keychain-value");
    expect(await getSecret("gemini_api_key")).toBe("keychain-value");

    await deleteSecret("gemini_api_key");
    expect(await getSecret("gemini_api_key")).toBe("");
  });

  it("treats empty values as deletions", async () => {
    enterDesktopMode();
    await setSecret("openai_api_key", "sk-something");
    await setSecret("openai_api_key", "");
    expect(keychain.has("openai_api_key")).toBe(false);
  });

  it("migrates legacy localStorage keys into the keychain and scrubs them", async () => {
    enterDesktopMode();
    localStorage.setItem("gemini_api_key", "legacy-key");
    await migrateLegacySecrets();

    expect(keychain.get("gemini_api_key")).toBe("legacy-key");
    expect(localStorage.getItem("gemini_api_key")).toBeNull();
  });

  it("keeps an existing keychain value during migration", async () => {
    enterDesktopMode();
    keychain.set("gemini_api_key", "keychain-wins");
    localStorage.setItem("gemini_api_key", "legacy-key");
    await migrateLegacySecrets();

    expect(keychain.get("gemini_api_key")).toBe("keychain-wins");
    expect(localStorage.getItem("gemini_api_key")).toBeNull();
  });

  it("hydrates the store and exposes sync accessors", async () => {
    keychain.set("openai_api_key", "sk-store");
    enterDesktopMode();
    await useKeysStore.getState().hydrate();

    expect(getStoredKey("openai_api_key")).toBe("sk-store");
    expect(hasAnyProviderKey()).toBe(true);
  });

  it("writes through setKey into the store and storage", async () => {
    enterDesktopMode();
    await useKeysStore.getState().hydrate();
    await useKeysStore.getState().setKey("deepgram_api_key", "dg-store");

    expect(useKeysStore.getState().keys.deepgram_api_key).toBe("dg-store");
    expect(keychain.get("deepgram_api_key")).toBe("dg-store");
    expect(hasAnyProviderKey()).toBe(true);
  });
});
