import { describe, expect, it } from "vitest";
import { confirmWritePrompt, requiresConfirm } from "../features/crm/lib/confirm-write";

describe("confirm-write", () => {
  it("requires a human on Closed and delete only", () => {
    expect(requiresConfirm("Closed")).toBe(true);
    expect(requiresConfirm("delete")).toBe(true);
    expect(requiresConfirm("Discovery")).toBe(false);
    expect(requiresConfirm("Outbound Call")).toBe(false);
  });

  it("names the lead in the prompt", () => {
    expect(confirmWritePrompt("Closed", "Ada")).toMatch(/Ada/);
    expect(confirmWritePrompt("Closed", "Ada")).toMatch(/human/i);
    expect(confirmWritePrompt("delete", "Ada")).toMatch(/cannot be undone/i);
  });
});
