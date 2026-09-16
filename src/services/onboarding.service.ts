import { invoke } from "@tauri-apps/api/core";
import type { ICP } from "../types";
import { getProviderKey } from "../stores/keys.store";

export async function processOnboardingChat(
  messages: { role: string; content: string }[]
): Promise<{ isComplete: boolean; reply?: string; icp?: ICP }> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("process_onboarding_chat", { messages, apiKey: apiKey || undefined });
}
