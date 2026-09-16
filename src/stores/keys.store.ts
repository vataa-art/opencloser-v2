// ============================================================
// Keys store — the single runtime source of provider API keys.
//
// Secrets are loaded from (and written to) the OS keychain via
// secure-keys. React components subscribe to this store for
// render-time decisions (e.g. the Demo Mode badge); adapters and
// services read through getProviderKey()/getStoredKey().
// ============================================================

import { create } from "zustand";
import {
  SECRET_KEYS,
  getSecret,
  migrateLegacySecrets,
  setSecret,
} from "../services/secure-keys";

interface KeysState {
  keys: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setKey: (key: string, value: string) => Promise<void>;
}

let hydratePromise: Promise<void> | null = null;

export const useKeysStore = create<KeysState>((set, get) => ({
  keys: {},
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (!hydratePromise) {
      hydratePromise = (async () => {
        await migrateLegacySecrets();
        const keys: Record<string, string> = {};
        for (const key of SECRET_KEYS) {
          keys[key] = await getSecret(key);
        }
        set({ keys, hydrated: true });
      })().finally(() => {
        hydratePromise = null;
      });
    }
    await hydratePromise;
  },

  setKey: async (key, value) => {
    const trimmed = value.trim();
    await setSecret(key, trimmed);
    set((state) => ({ keys: { ...state.keys, [key]: trimmed } }));
  },
}));

/** Sync read for non-React modules; call after hydrate() for real values. */
export function getStoredKey(key: string): string {
  return useKeysStore.getState().keys[key] ?? "";
}

export function hasAnyProviderKey(): boolean {
  const { keys } = useKeysStore.getState();
  return SECRET_KEYS.some((key) => !!keys[key]?.trim());
}

/** Async read that guarantees hydration — use inside connect()/services. */
export async function getProviderKey(key: string): Promise<string> {
  await useKeysStore.getState().hydrate();
  return getStoredKey(key);
}
