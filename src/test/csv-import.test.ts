import { describe, it, expect } from "vitest";
import { parseLeadsCsv, serializeLeadsCsv } from "../features/crm/lib/csv";

describe("CSV Import", () => {
  it("handles quoted company with comma", () => {
    const csv = `Name,Company,Phone\nJohn Doe,"Acme, Inc.",1234567890`;
    const { leads, skipped, errors } = parseLeadsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(skipped).toBe(0);
    expect(leads).toHaveLength(1);
    expect(leads[0].company).toBe("Acme, Inc.");
  });

  it("skips missing phone or name", () => {
    const csv = `Name,Company,Phone\nJohn Doe,Acme,\n,Acme,1234567890`;
    const { leads, skipped } = parseLeadsCsv(csv);
    expect(leads).toHaveLength(0);
    expect(skipped).toBe(2);
  });

  it("handles duplicate phone in file", () => {
    const csv = `Name,Company,Phone\nJohn Doe,Acme,1234567890\nJane Doe,Acme2,1234567890`;
    const { leads, skipped } = parseLeadsCsv(csv);
    expect(leads).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(leads[0].name).toBe("John Doe");
  });

  it("does not invent empty email", () => {
    const csv = `Name,Company,Phone,Email\nJohn Doe,Acme,1234567890,`;
    const { leads } = parseLeadsCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].email).toBeUndefined();
  });

  it("round-trip serialize -> parse preserves name/company/phone", () => {
    const rows = [
      { name: "John Doe", company: "Acme, Inc.", phone: "1234567890", score: 50 }
    ];
    const serialized = serializeLeadsCsv(rows);
    const { leads } = parseLeadsCsv(serialized);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe("John Doe");
    expect(leads[0].company).toBe("Acme, Inc.");
    expect(leads[0].phone).toBe("1234567890");
    expect(leads[0].score).toBe(50);
  });

  it("handles case-insensitive header", () => {
    const csv = `NAME,PHONE,COMPANY\nJohn Doe,1234567890,Acme`;
    const { leads } = parseLeadsCsv(csv);
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe("John Doe");
    expect(leads[0].company).toBe("Acme");
    expect(leads[0].phone).toBe("1234567890");
  });
});
