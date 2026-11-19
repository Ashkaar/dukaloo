"use client";

import { parseScaleReading } from "@/lib/scale";

// Reading a scale on the till's USB or serial port (Web Serial: Chrome and
// Edge on computers). The first time, the browser asks which port; after
// that the same port is used without asking.

interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}

const serial = (): SerialLike | null => (typeof navigator !== "undefined" && "serial" in navigator ? ((navigator as unknown as { serial: SerialLike }).serial ?? null) : null);

export const scaleSupported = () => serial() !== null;

export class ScaleError extends Error {
  constructor(public reason: "no-port" | "no-reading") {
    super(reason);
  }
}

// The weight on the scale, in grams.
export async function readScale(baudRate: number, timeoutMs = 3000): Promise<number> {
  const s = serial();
  if (!s) throw new ScaleError("no-port");
  let port: SerialPortLike;
  try {
    port = (await s.getPorts())[0] ?? (await s.requestPort());
  } catch {
    throw new ScaleError("no-port");
  }
  try {
    await port.open({ baudRate });
  } catch {
    // Already open (another read still closing): carry on with it.
  }
  if (!port.readable) throw new ScaleError("no-port");
  const reader = port.readable.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let asked = false;
  const until = Date.now() + timeoutMs;
  try {
    while (Date.now() < until) {
      const timer = new Promise<null>((r) => setTimeout(() => r(null), 400));
      const chunk = await Promise.race([reader.read(), timer]);
      if (chunk === null) {
        // Some scales only answer when asked ("W" is the common command).
        if (!asked && port.writable) {
          asked = true;
          const w = port.writable.getWriter();
          await w.write(new TextEncoder().encode("W\r\n")).catch(() => {});
          w.releaseLock();
        }
        continue;
      }
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
      // A full line with a weight in it.
      const lines = text.split(/[\r\n]+/);
      for (let i = lines.length - 2; i >= 0; i--) {
        const grams = parseScaleReading(lines[i]);
        if (grams !== null) return grams;
      }
    }
    const grams = parseScaleReading(text);
    if (grams !== null) return grams;
    throw new ScaleError("no-reading");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    await port.close().catch(() => {});
  }
}
