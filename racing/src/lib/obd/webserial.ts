/**
 * Web Serial transport for ELM327. Works in Chromium-based desktop browsers
 * and Chrome Android with USB-OTG. Requires HTTPS (or localhost).
 */

import type { ElmPort } from "./elm327";

const COMMON_BAUDS = [38400, 115200, 9600, 500000];

export async function requestSerialPort(): Promise<SerialPort> {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial not supported in this browser. Try Chrome or Edge.");
  }
  return navigator.serial.requestPort();
}

export async function openSerialPort(
  port: SerialPort,
  baudRate = 38400,
): Promise<ElmPort> {
  await port.open({ baudRate });
  return wrap(port);
}

/**
 * Try a sequence of bauds until one yields an ELM327 prompt within `timeoutMs`.
 * Returns the opened ElmPort or throws if all fail.
 */
export async function autoOpenSerialPort(port: SerialPort): Promise<ElmPort> {
  let lastErr: unknown;
  for (const baud of COMMON_BAUDS) {
    try {
      await port.open({ baudRate: baud });
      return wrap(port);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Failed to open serial port: ${String(lastErr)}`);
}

function wrap(port: SerialPort): ElmPort {
  const writer = port.writable!.getWriter();
  const reader = port.readable!.getReader();
  return {
    async write(bytes) {
      await writer.write(bytes);
    },
    read: async function* () {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    },
    async close() {
      try { writer.releaseLock(); } catch {}
      try { reader.releaseLock(); } catch {}
      await port.close();
    },
  };
}
