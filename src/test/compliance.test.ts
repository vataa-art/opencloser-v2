import { describe, expect, it } from "vitest";
import {
  canStartDemoCall,
  canStartLiveCall,
  isDoNotCall,
  liveCallBlockReason,
} from "../features/crm/lib/compliance";
import { Lead } from "../types";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    name: "Ada",
    company: "Co",
    phone: "+15550001",
    status: "Outbound Call",
    score: 80,
    created_at: "2026-01-01",
    dnc: 0,
    consent_at: null,
    opted_out_at: null,
    ...overrides,
  };
}

describe("dialer compliance", () => {
  it("lets a demo engine run without consent", () => {
    expect(canStartDemoCall(lead())).toBe(true);
    expect(canStartLiveCall(lead())).toBe(false);
    expect(liveCallBlockReason(lead())).toMatch(/consent/i);
  });

  it("blocks DNC leads from every engine", () => {
    const dnc = lead({ dnc: 1 });
    expect(isDoNotCall(dnc)).toBe(true);
    expect(canStartDemoCall(dnc)).toBe(false);
    expect(canStartLiveCall(dnc)).toBe(false);
    expect(liveCallBlockReason(dnc)).toMatch(/Do Not Call/);
  });

  it("blocks opted-out leads even if dnc flag is 0", () => {
    const opted = lead({ opted_out_at: "2026-01-02T00:00:00Z" });
    expect(isDoNotCall(opted)).toBe(true);
    expect(canStartDemoCall(opted)).toBe(false);
  });

  it("allows a live engine only after consent and not DNC", () => {
    const ready = lead({ consent_at: "2026-01-02T00:00:00Z" });
    expect(canStartLiveCall(ready)).toBe(true);
    expect(liveCallBlockReason(ready)).toBeNull();
  });
});
