export type LeadStatus =
  | "Discovery"
  | "Outbound Call"
  | "Audit Requested"
  | "Closed";

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string;
  title?: string;
  linkedin_url?: string;
  notes?: string;
  industry?: string;
  status: LeadStatus;
  score: number;
  created_at: string;
  dnc?: number;
  consent_at?: string | null;
  opted_out_at?: string | null;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: string;
  description: string;
  timestamp: string;
  duration: number;
}

export interface Campaign {
  id: string;
  name: string;
  target_criteria: string;
  status: string;
  created_at: string;
}

export interface CallSession {
  id: string;
  lead_id: string;
  provider: string;
  duration_seconds: number;
  transcript: string;
  status: string;
  sentiment: string;
  objections_handled: string;
  emotion_log: string;
  created_at: string;
}

export interface ICP {
  targetAudience: string;
  industry: string;
  companySize: string;
  decisionMakerTitles: string[];
  painPoints: string[];
  objections: string[];
  competitorNames: string[];
  valueProposition: string;
  salesMethodology: "SPIN Selling" | "Challenger Sale" | "Sandler System" | "Straight Line Persuasion";
  systemPrompt: string;
}
