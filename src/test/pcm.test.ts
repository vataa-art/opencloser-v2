import { describe, expect, it } from "vitest";
import { decodeBase64Pcm } from "../features/voice/lib/pcm";

describe("PCM decoder", () => {
  it("preserves signed little-endian PCM16 samples", () => {
    const samples = decodeBase64Pcm("AAD/fwCA//8=");

    expect(Array.from(samples)).toEqual([
      0,
      32767 * 3.0517578125e-5,
      -32768 * 3.0517578125e-5,
      -1 * 3.0517578125e-5,
    ]);
  });

  it("keeps the existing odd-byte truncation behavior", () => {
    expect(decodeBase64Pcm("AAAA")).toHaveLength(1);
  });
});
