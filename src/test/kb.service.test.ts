import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../stores/keys.store", () => ({ getProviderKey: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { getProviderKey } from "../stores/keys.store";
import { kbIngestDocument, kbSearch } from "../services/kb.service";

const mockedInvoke = vi.mocked(invoke);
const mockedGetKey = vi.mocked(getProviderKey);

describe("kb.service", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedGetKey.mockReset();
    mockedGetKey.mockResolvedValue("test-key");
  });

  it("kbSearch invokes kb_search with query, domain and k", async () => {
    mockedInvoke.mockResolvedValue({
      results: [{ source: "vHG4m5ptmJs", text: "API design", score: 0.42 }],
      embedder: "local-hash-256",
    });

    const res = await kbSearch({ query: "what is an API", domain: "recruitment", k: 3 });

    expect(mockedInvoke).toHaveBeenCalledWith("kb_search", {
      query: "what is an API",
      domain: "recruitment",
      k: 3,
      apiKey: "test-key",
    });
    expect(res.results[0].source).toBe("vHG4m5ptmJs");
    expect(res.embedder).toBe("local-hash-256");
  });

  it("kbSearch omits optional args when not provided", async () => {
    mockedInvoke.mockResolvedValue({ results: [], embedder: "local-hash-256" });

    await kbSearch({ query: "salary questions" });

    expect(mockedInvoke).toHaveBeenCalledWith("kb_search", {
      query: "salary questions",
      domain: undefined,
      k: undefined,
      apiKey: "test-key",
    });
  });

  it("kbIngestDocument invokes kb_ingest_document and returns chunk count", async () => {
    mockedInvoke.mockResolvedValue({ chunks: 12, embedder: "local-hash-256" });

    const res = await kbIngestDocument({
      domain: "recruitment",
      source: "vHG4m5ptmJs",
      text: "raw transcript text",
      tags: ["api"],
    });

    expect(mockedInvoke).toHaveBeenCalledWith("kb_ingest_document", {
      domain: "recruitment",
      source: "vHG4m5ptmJs",
      text: "raw transcript text",
      tags: ["api"],
      apiKey: "test-key",
    });
    expect(res.chunks).toBe(12);
  });

  it("kbIngestDocument normalizes missing tags to undefined", async () => {
    mockedInvoke.mockResolvedValue({ chunks: 1, embedder: "local-hash-256" });

    await kbIngestDocument({ domain: "sales", source: "s1", text: "t" });

    expect(mockedInvoke).toHaveBeenCalledWith("kb_ingest_document", {
      domain: "sales",
      source: "s1",
      text: "t",
      tags: undefined,
      apiKey: "test-key",
    });
  });
});
