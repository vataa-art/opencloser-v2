import { invoke } from "@tauri-apps/api/core";
import type { ICP } from "../types";
import { getProviderKey } from "../stores/keys.store";

export interface LeadResult {
  name: string;
  company: string;
  phone: string;
  email: string;
  title: string;
  linkedin_url: string;
  score: number;
}

export interface CallAnalysis {
  summary: string;
  sentiment: "Positive" | "Neutral" | "Negative" | "Mixed";
  objectionsRaised: string[];
  keyInsights: string[];
  nextSteps: string[];
  followUpEmail: string;
  emailSubject: string;
}

/**
 * Generate a fictional demo lead list for call rehearsal. There is no web
 * scraping: with a Gemini key the model invents plausible-but-fictional
 * leads, without a key a local offline generator is used.
 */
export async function generateDemoLeads(
  query: string,
  location: string,
  icp: ICP | null
): Promise<LeadResult[]> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("generate_demo_leads", { query, location, icp, apiKey: apiKey || undefined });
}

export async function analyzeCallTranscript(
  transcript: string,
  leadName: string,
  leadCompany: string,
  icp: string | null
): Promise<CallAnalysis> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("analyze_call_transcript", {
    transcript,
    leadName,
    leadCompany,
    icp,
    apiKey: apiKey || undefined,
  });
}

export interface ObjectionTrainerResponse {
  role: string;
  text: string;
  is_complete: boolean;
  score?: number;
  strengths: string[];
  improvements: string[];
  rebuttal_tip: string;
}

export async function objectionTrainerTurn(req: {
  mode: string;
  objection: string;
  difficulty: string;
  messages: { role: string; text: string }[];
  icp: any;
}): Promise<ObjectionTrainerResponse> {
  const apiKey = await getProviderKey("gemini_api_key");
  return invoke("objection_trainer_turn", {
    req: { ...req, apiKey: apiKey || undefined },
  });
}
