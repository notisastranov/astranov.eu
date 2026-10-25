/**
 * ELM327 driver. ELM327 is a serial-line modem: ASCII commands terminated
 * with \r, responses terminated with ">". This driver:
 *   - issues the canonical init sequence (ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0)
 *   - serialises commands (one at a time) so responses don't interleave
 *   - parses out the prompt and returns clean frame strings to callers
 *
 * Transport-level send/receive lives behind a tiny port interface so we
 * can plug Web Serial, Web Bluetooth (BLE), or a mock implementation in.
 */

export interface ElmPort {
  write(bytes: Uint8Array): Promise<void>;
  /** Yields chunks as they arrive. Caller stops by breaking the loop. */
  read(): AsyncIterableIterator<Uint8Array>;
  close(): Promise<void>;
}

const PROMPT = ">".charCodeAt(0);
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);

export class Elm327 {
  private buffer = "";
  private busy = false;
  private queue: Array<() => void> = [];
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private reading = false;

  constructor(private port: ElmPort) {}

  async init(): Promise<{ protocol: string; voltage: number | null }> {
    void this.pump();
    await this.command("ATZ", 3000);     // reset
    await this.command("ATE0");          // echo off
    await this.command("ATL0");          // linefeeds off
    await this.command("ATS0");          // spaces off
    await this.command("ATH0");          // headers off
    await this.command("ATSP0");         // auto protocol
    const protoResp = await this.command("ATDP");
    const voltResp = await this.command("ATRV");
    const voltage = parseFloat(voltResp.join("").replace(/[^0-9.]/g, "")) || null;
    return { protocol: protoResp.join("").trim() || "auto", voltage };
  }

  async command(cmd: string, timeoutMs = 1500): Promise<string[]> {
    while (this.busy) {
      await new Promise<void>((res) => this.queue.push(res));
    }
    this.busy = true;
    try {
      this.buffer = "";
      await this.port.write(this.encoder.encode(cmd + "\r"));
      const reply = await this.waitForPrompt(timeoutMs);
      return reply
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l && l !== cmd && !/^SEARCHING/i.test(l));
    } finally {
      this.busy = false;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  async close() {
    this.reading = false;
    await this.port.close();
  }

  private async pump() {
    if (this.reading) return;
    this.reading = true;
    try {
      for await (const chunk of this.port.read()) {
        if (!this.reading) break;
        const txt = this.decoder.decode(chunk, { stream: true });
        this.buffer += txt;
      }
    } catch {
      // transport closed
    }
  }

  private async waitForPrompt(timeoutMs: number): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.buffer.indexOf(">");
      if (idx >= 0) {
        const out = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        return out;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`ELM327 timeout after ${timeoutMs}ms waiting for prompt`);
  }
}

export { PROMPT, CR, LF };
