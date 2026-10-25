/**
 * Adapter contract. All transports (Web Serial, Web Bluetooth, simulated,
 * future USB-CAN) implement this so the rest of the app stays transport-agnostic.
 */

export type AdapterStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface AdapterInfo {
  kind: "webserial" | "webbluetooth" | "simulated";
  name: string;
  protocol?: string;
  voltage?: number;
}

export interface ObdAdapter {
  readonly info: AdapterInfo;
  readonly status: AdapterStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * Send a raw OBD-II command (e.g. "0100", "010C", "03") and return the
   * raw response bytes as hex strings, one frame per array entry.
   */
  send(command: string): Promise<string[]>;
  on(event: "status", cb: (s: AdapterStatus) => void): () => void;
}

export class AdapterError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AdapterError";
  }
}
