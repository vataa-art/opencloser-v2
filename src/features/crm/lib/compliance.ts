import { Lead } from "../../../types";

export function isDoNotCall(lead: Pick<Lead, "dnc" | "opted_out_at">): boolean {
  return Number(lead.dnc ?? 0) !== 0 || Boolean(lead.opted_out_at && String(lead.opted_out_at).trim());
}

export function hasConsent(lead: Pick<Lead, "consent_at">): boolean {
  return Boolean(lead.consent_at && String(lead.consent_at).trim());
}

export function canStartDemoCall(lead: Pick<Lead, "dnc" | "opted_out_at">): boolean {
  return !isDoNotCall(lead);
}

export function canStartLiveCall(
  lead: Pick<Lead, "dnc" | "opted_out_at" | "consent_at">,
): boolean {
  return canStartDemoCall(lead) && hasConsent(lead);
}

export function liveCallBlockReason(
  lead: Pick<Lead, "dnc" | "opted_out_at" | "consent_at">,
): string | null {
  if (Number(lead.dnc ?? 0) !== 0) return "Lead is on the Do Not Call list";
  if (lead.opted_out_at && String(lead.opted_out_at).trim()) return "Lead has opted out";
  if (!hasConsent(lead)) return "Record consent before a live provider call";
  return null;
}
