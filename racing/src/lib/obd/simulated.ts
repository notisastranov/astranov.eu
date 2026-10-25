/**
 * Simulated ELM327 backend. Drives the UI without hardware — generates
 * believable PIDs that drift on a slow waveform plus noise, and reports
 * a small rotating set of DTCs. Indispensable for CI and demos.
 */

import type { AdapterInfo, AdapterStatus, ObdAdapter } from "./adapter";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function noise(amp: number) {
  return (Math.random() - 0.5) * 2 * amp;
}

interface SimState {
  startedAt: number;
  rpmBase: number;
  speedBase: number;
  ect: number;
  iat: number;
  vbat: number;
  dtcs: string[];
}

const DTC_BANK: string[][] = [
  [],
  ["P0420"],
  ["P0171", "P0301"],
  ["P0128", "P0455"],
  ["P0300", "P0301", "P0302", "P0171"],
];

function frame(s: string) {
  return [s.trim().replace(/\s+/g, "")];
}

function encodeFloat(value: number, bytes: number, transform: (v: number) => number) {
  const v = Math.round(transform(value));
  if (bytes === 1) return [clamp(v, 0, 255)];
  return [clamp((v >> 8) & 0xff, 0, 255), clamp(v & 0xff, 0, 255)];
}

export class SimulatedAdapter implements ObdAdapter {
  readonly info: AdapterInfo = {
    kind: "simulated",
    name: "Simulated ECU",
    protocol: "ISO 15765-4 (CAN 11/500) [sim]",
    voltage: 14.1,
  };
  status: AdapterStatus = "disconnected";
  private listeners = new Set<(s: AdapterStatus) => void>();
  private state: SimState = {
    startedAt: Date.now(),
    rpmBase: 850,
    speedBase: 0,
    ect: 35,
    iat: 22,
    vbat: 14.2,
    dtcs: DTC_BANK[Math.floor(Math.random() * DTC_BANK.length)],
  };

  async connect() {
    this.setStatus("connecting");
    await new Promise((r) => setTimeout(r, 400));
    this.setStatus("connected");
  }

  async disconnect() {
    this.setStatus("disconnected");
  }

  on(event: "status", cb: (s: AdapterStatus) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  async send(command: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 15));
    const cmd = command.toUpperCase().replace(/\s+/g, "");

    if (cmd.startsWith("AT")) return frame("OK");

    if (cmd === "03") {
      // Mode 03 — current DTCs
      const dtcs = this.state.dtcs;
      const parts = ["43", dtcs.length.toString(16).padStart(2, "0")];
      for (const code of dtcs) parts.push(...encodeDtc(code));
      return [parts.join("")];
    }

    if (cmd === "04") {
      this.state.dtcs = [];
      return frame("44");
    }

    if (cmd === "0902") {
      // VIN — returns a plausible 17-char ASCII string framed as multi-line.
      const vin = "1HGCM82633A004352";
      const hex = Array.from(vin).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
      return frame("4902" + "01" + hex);
    }

    if (cmd.startsWith("01")) {
      const pid = cmd.slice(2);
      const bytes = this.simulatePid(pid);
      if (!bytes) return frame("NO DATA");
      return frame("41" + pid + bytes.map((b) => b.toString(16).padStart(2, "0")).join(""));
    }

    return frame("?");
  }

  private setStatus(s: AdapterStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  private simulatePid(pid: string): number[] | null {
    const t = (Date.now() - this.state.startedAt) / 1000;
    const driving = Math.max(0, Math.sin(t / 30));
    switch (pid) {
      case "00": return [0xBE, 0x3E, 0xB8, 0x11];
      case "20": return [0x80, 0x07, 0xB0, 0x01];
      case "04": return [Math.round(clamp(20 + driving * 60 + noise(5), 0, 100) * 2.55)];
      case "05": {
        this.state.ect = clamp(this.state.ect + (90 - this.state.ect) * 0.01, 20, 105);
        return [Math.round(this.state.ect + 40)];
      }
      case "06": return [Math.round(clamp(128 + noise(8), 0, 255))];
      case "07": return [Math.round(clamp(128 - 4 + noise(2), 0, 255))];
      case "0B": return [Math.round(clamp(30 + driving * 70 + noise(3), 10, 200))];
      case "0C": {
        const rpm = this.state.rpmBase + driving * 3500 + noise(120);
        return encodeFloat(rpm, 2, (v) => v * 4);
      }
      case "0D": {
        this.state.speedBase = clamp(driving * 120 + noise(3), 0, 200);
        return [Math.round(this.state.speedBase)];
      }
      case "0E": return [Math.round(clamp(20 + driving * 20 + noise(5), 0, 255) * 2)];
      case "0F": {
        this.state.iat = clamp(this.state.iat + noise(0.2), 15, 60);
        return [Math.round(this.state.iat + 40)];
      }
      case "10": return encodeFloat(clamp(2 + driving * 40 + noise(2), 0, 200), 2, (v) => v * 100);
      case "11": return [Math.round(clamp(driving * 90 + noise(4), 0, 100) * 2.55)];
      case "1F": return encodeFloat((Date.now() - this.state.startedAt) / 1000, 2, (v) => v);
      case "2F": return [Math.round(60 * 2.55)];
      case "33": return [Math.round(101)];
      case "42": {
        this.state.vbat = clamp(this.state.vbat + noise(0.02), 13.8, 14.6);
        return encodeFloat(this.state.vbat, 2, (v) => v * 1000);
      }
      case "44": return encodeFloat(1.0 + noise(0.02), 2, (v) => (v * 65536) / 2);
      case "46": return [Math.round(22 + 40 + noise(1))];
      case "5C": return [Math.round(85 + 40 + noise(2))];
      case "5E": return encodeFloat(clamp(driving * 18 + 1, 0, 80), 2, (v) => v * 20);
      default:   return null;
    }
  }
}

function encodeDtc(code: string): string[] {
  const prefix = code[0];
  const second = parseInt(code[1], 10);
  const a = ((prefix === "P" ? 0 : prefix === "C" ? 1 : prefix === "B" ? 2 : 3) << 6)
          | ((second & 0b11) << 4)
          | parseInt(code[2], 16);
  const b = (parseInt(code[3], 16) << 4) | parseInt(code[4], 16);
  return [a.toString(16).padStart(2, "0"), b.toString(16).padStart(2, "0")];
}
