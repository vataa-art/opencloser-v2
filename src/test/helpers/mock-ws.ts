// Shared test doubles: a controllable WebSocket stub and helpers used by
// the provider contract tests.

import { vi } from "vitest";

export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  binaryType: string = "blob";
  readyState = MockWebSocket.CONNECTING;
  sent: (string | ArrayBuffer)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    MockWebSocket.instances.push(this);
    this.url = url;
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // ── Test controls ──
  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  serverText(payload: unknown): void {
    this.onmessage?.({ data: typeof payload === "string" ? payload : JSON.stringify(payload) });
  }

  serverBinary(bytes: Uint8Array): void {
    this.onmessage?.({ data: bytes.slice().buffer });
  }

  lastText(): Record<string, unknown> {
    const last = [...this.sent].reverse().find((d) => typeof d === "string");
    return last ? JSON.parse(last as string) : {};
  }

  sentBinary(): ArrayBuffer[] {
    return this.sent.filter((d): d is ArrayBuffer => d instanceof ArrayBuffer);
  }
}

export function stubWebSocket(): void {
  vi.stubGlobal("WebSocket", MockWebSocket);
  MockWebSocket.instances = [];
}

export function lastSocket(): MockWebSocket {
  const sockets = MockWebSocket.instances;
  if (sockets.length === 0) throw new Error("No MockWebSocket was created");
  return sockets[sockets.length - 1];
}

/**
 * Wait for an adapter's async connect() to reach `new WebSocket(...)`.
 * connect() suspends on several awaits before the socket exists, so tests
 * must yield to the event loop first.
 */
export async function waitForSocket(maxMs = 1000): Promise<MockWebSocket> {
  const start = Date.now();
  while (MockWebSocket.instances.length === 0 && Date.now() - start < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  return lastSocket();
}
