// ============================================================
// Secure key storage — the single gateway for provider secrets.
//
// In the desktop app, secrets live in the OS keychain (Windows
// Credential Manager / macOS Keychain / Secret Service) through
// Tauri commands; the WebView never persists them. In a plain
// browser dev run (no Tauri IPC) an in-memory map keeps secrets
// for the current session only.
// ============================================================

import { invoke } from "@tauri-apps/api/core";

/** Every secret the app stores. Add new provider keys here. */
export const SECRET_KEYS = [
  "gemini_api_key",
  "openai_api_key",
  "elevenlabs_api_key",
  "deepgram_api_key",
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

const memoryFallback = new Map<string, string>();

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSecret(key: string): Promise<string> {
  if (isDesktop()) {
    try {
      const value = await invoke<string | null>("secret_get", { name: key });
      return value ?? "";
    } catch (error) {
      console.error(`Failed to read secret '${key}' from keychain:`, error);
      return "";
    }
  }
  return memoryFallback.get(key) ?? "";
}

export async function setSecret(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (isDesktop()) {
    await invoke("secret_set", { name: key, value: trimmed });
    return;
  }
  if (trimmed) memoryFallback.set(key, trimmed);
  else memoryFallback.delete(key);
}

export async function deleteSecret(key: string): Promise<void> {
  if (isDesktop()) {
    try {
      await invoke("secret_delete", { name: key });
    } catch (error) {
      console.error(`Failed to delete secret '${key}' from keychain:`, error);
    }
    return;
  }
  memoryFallback.delete(key);
}

/**
 * One-time migration from builds that kept API keys in localStorage:
 * the value moves to the OS keychain and is scrubbed from WebView storage.
 * Idempotent — localStorage is always cleared, and an existing keychain
 * value always wins over a stale legacy value.
 */
export async function migrateLegacySecrets(): Promise<void> {
  if (!isDesktop()) return;
  for (const key of SECRET_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy === null) continue;
    localStorage.removeItem(key);
    const trimmed = legacy.trim();
    if (!trimmed) continue;
    const existing = await getSecret(key);
    if (!existing) {
      await setSecret(key, trimmed);
      console.info(`Migrated '${key}' from localStorage to the OS keychain.`);
    }
  }
}
