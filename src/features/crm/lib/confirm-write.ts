import type { LeadStatus } from "../../../types";

export type ConfirmWriteKind = "Closed" | "delete";

export function requiresConfirm(next: LeadStatus | "delete"): boolean {
  return next === "Closed" || next === "delete";
}

export function confirmWritePrompt(kind: ConfirmWriteKind, name: string): string {
  if (kind === "delete") {
    return `Delete ${name} and all associated data? This cannot be undone.`;
  }
  return `Move ${name} to Closed? A human must confirm — copilot cannot close deals.`;
}
