/**
 * Bridges the ELM327 driver to the ObdAdapter contract that pages use.
 * Holds the transport, surfaces status changes, and exposes raw `send`.
 */

import type { AdapterInfo, AdapterStatus, ObdAdapter } from "./adapter";
import { Elm327, type ElmPort } from "./elm327";

export class ElmAdapter implements ObdAdapter {
  status: AdapterStatus = "disconnected";
  info: AdapterInfo;
  private elm: Elm327;
  private listeners = new Set<(s: AdapterStatus) => void>();

  constructor(port: ElmPort, kind: "webserial" | "webbluetooth", name: string) {
    this.elm = new Elm327(port);
    this.info = { kind, name };
  }

  async connect() {
    this.setStatus("connecting");
    try {
      const meta = await this.elm.init();
      this.info = { ...this.info, protocol: meta.protocol, voltage: meta.voltage ?? undefined };
      this.setStatus("connected");
    } catch (err) {
      this.setStatus("error");
      throw err;
    }
  }

  async disconnect() {
    await this.elm.close();
    this.setStatus("disconnected");
  }

  async send(cmd: string) {
    return this.elm.command(cmd);
  }

  on(event: "status", cb: (s: AdapterStatus) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private setStatus(s: AdapterStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }
}
