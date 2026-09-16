interface Uint8ArrayBase64Constructor {
  fromBase64?: (base64: string) => Uint8Array;
}

/** Decode little-endian PCM16 base64 into Web Audio's Float32 format. */
export function decodeBase64Pcm(base64: string): Float32Array {
  const bytes = decodeBase64Bytes(base64);
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
  const float32 = new Float32Array(int16.length);

  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] * 3.0517578125e-5;
  }
  return float32;
}

function decodeBase64Bytes(base64: string): Uint8Array {
  // Chromium's native decoder avoids allocating an intermediate binary string
  // and calling charCodeAt once per byte on every streamed audio chunk.
  const nativeDecoder = (Uint8Array as unknown as Uint8ArrayBase64Constructor).fromBase64;
  if (nativeDecoder) return nativeDecoder(base64);

  // Compatibility path for WebViews without Uint8Array.fromBase64.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
