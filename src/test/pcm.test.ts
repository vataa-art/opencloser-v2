import { describe, expect, it } from "vitest";
import { decodeBase64Pcm } from "../features/voice/lib/pcm";
import { resampleFloat32 } from "../features/voice/lib/adapters/base";

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

describe("audio resampling", () => {
  it("resamples 16 kHz capture to the 24 kHz OpenAI Realtime input rate", () => {
    const output = resampleFloat32(new Float32Array([0, 1, 0, -1]), 16000, 24000);

    expect(output).toHaveLength(6);
    expect(Array.from(output).every(Number.isFinite)).toBe(true);
    expect(Math.max(...output)).toBeLessThanOrEqual(1);
    expect(Math.min(...output)).toBeGreaterThanOrEqual(-1);
  });
});
