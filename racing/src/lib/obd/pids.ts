/**
 * SAE J1979 standard Mode 01 PIDs. Formulas come from the public J1979 spec
 * (and the Wikipedia OBD-II PIDs table). Anything outside this list is
 * vehicle-specific and lives in the per-make definition files.
 */

export interface PidDef {
  pid: string;            // hex, no spaces, e.g. "0C"
  name: string;
  shortName: string;
  unit: string;
  bytes: number;          // expected data bytes after the response header
  min: number;
  max: number;
  decode: (bytes: number[]) => number;
}

const pct = (b: number) => (b * 100) / 255;

export const PIDS: Record<string, PidDef> = {
  "04": {
    pid: "04", name: "Calculated engine load", shortName: "LOAD",
    unit: "%", bytes: 1, min: 0, max: 100,
    decode: ([a]) => pct(a),
  },
  "05": {
    pid: "05", name: "Engine coolant temperature", shortName: "ECT",
    unit: "°C", bytes: 1, min: -40, max: 215,
    decode: ([a]) => a - 40,
  },
  "06": {
    pid: "06", name: "Short term fuel trim, Bank 1", shortName: "STFT1",
    unit: "%", bytes: 1, min: -100, max: 99.2,
    decode: ([a]) => (a - 128) * (100 / 128),
  },
  "07": {
    pid: "07", name: "Long term fuel trim, Bank 1", shortName: "LTFT1",
    unit: "%", bytes: 1, min: -100, max: 99.2,
    decode: ([a]) => (a - 128) * (100 / 128),
  },
  "0A": {
    pid: "0A", name: "Fuel pressure", shortName: "FP",
    unit: "kPa", bytes: 1, min: 0, max: 765,
    decode: ([a]) => a * 3,
  },
  "0B": {
    pid: "0B", name: "Intake manifold absolute pressure", shortName: "MAP",
    unit: "kPa", bytes: 1, min: 0, max: 255,
    decode: ([a]) => a,
  },
  "0C": {
    pid: "0C", name: "Engine RPM", shortName: "RPM",
    unit: "rpm", bytes: 2, min: 0, max: 16383.75,
    decode: ([a, b]) => (a * 256 + b) / 4,
  },
  "0D": {
    pid: "0D", name: "Vehicle speed", shortName: "SPEED",
    unit: "km/h", bytes: 1, min: 0, max: 255,
    decode: ([a]) => a,
  },
  "0E": {
    pid: "0E", name: "Timing advance", shortName: "ADV",
    unit: "° before TDC", bytes: 1, min: -64, max: 63.5,
    decode: ([a]) => a / 2 - 64,
  },
  "0F": {
    pid: "0F", name: "Intake air temperature", shortName: "IAT",
    unit: "°C", bytes: 1, min: -40, max: 215,
    decode: ([a]) => a - 40,
  },
  "10": {
    pid: "10", name: "Mass air flow rate", shortName: "MAF",
    unit: "g/s", bytes: 2, min: 0, max: 655.35,
    decode: ([a, b]) => (a * 256 + b) / 100,
  },
  "11": {
    pid: "11", name: "Throttle position", shortName: "TPS",
    unit: "%", bytes: 1, min: 0, max: 100,
    decode: ([a]) => pct(a),
  },
  "1F": {
    pid: "1F", name: "Run time since engine start", shortName: "RUNTM",
    unit: "s", bytes: 2, min: 0, max: 65535,
    decode: ([a, b]) => a * 256 + b,
  },
  "21": {
    pid: "21", name: "Distance with MIL on", shortName: "MILDIST",
    unit: "km", bytes: 2, min: 0, max: 65535,
    decode: ([a, b]) => a * 256 + b,
  },
  "2F": {
    pid: "2F", name: "Fuel tank level", shortName: "FUEL",
    unit: "%", bytes: 1, min: 0, max: 100,
    decode: ([a]) => pct(a),
  },
  "33": {
    pid: "33", name: "Barometric pressure", shortName: "BARO",
    unit: "kPa", bytes: 1, min: 0, max: 255,
    decode: ([a]) => a,
  },
  "42": {
    pid: "42", name: "Control module voltage", shortName: "VBAT",
    unit: "V", bytes: 2, min: 0, max: 65.535,
    decode: ([a, b]) => (a * 256 + b) / 1000,
  },
  "43": {
    pid: "43", name: "Absolute load value", shortName: "ABSLOAD",
    unit: "%", bytes: 2, min: 0, max: 25700,
    decode: ([a, b]) => ((a * 256 + b) * 100) / 255,
  },
  "44": {
    pid: "44", name: "Commanded air-fuel ratio", shortName: "AFR",
    unit: "λ", bytes: 2, min: 0, max: 2,
    decode: ([a, b]) => ((a * 256 + b) * 2) / 65536,
  },
  "45": {
    pid: "45", name: "Relative throttle position", shortName: "RTPS",
    unit: "%", bytes: 1, min: 0, max: 100,
    decode: ([a]) => pct(a),
  },
  "46": {
    pid: "46", name: "Ambient air temperature", shortName: "AAT",
    unit: "°C", bytes: 1, min: -40, max: 215,
    decode: ([a]) => a - 40,
  },
  "5C": {
    pid: "5C", name: "Engine oil temperature", shortName: "OIL",
    unit: "°C", bytes: 1, min: -40, max: 210,
    decode: ([a]) => a - 40,
  },
  "5E": {
    pid: "5E", name: "Engine fuel rate", shortName: "FRATE",
    unit: "L/h", bytes: 2, min: 0, max: 3212.75,
    decode: ([a, b]) => (a * 256 + b) / 20,
  },
};

/**
 * Parse a raw ELM327 response into decoded numeric values.
 * Expected format after stripping echo & whitespace: "41 0C 1A F8".
 * Returns null if the frame doesn't match the requested PID.
 */
export function decodePidResponse(pid: string, frames: string[]): number | null {
  const flat = frames.join(" ").replace(/[^0-9A-Fa-f ]/g, "").trim();
  const tokens = flat.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const wantPid = pid.toUpperCase();
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (tokens[i].toUpperCase() === "41" && tokens[i + 1].toUpperCase() === wantPid) {
      const def = PIDS[wantPid];
      if (!def) return null;
      const data = tokens.slice(i + 2, i + 2 + def.bytes).map((t) => parseInt(t, 16));
      if (data.length < def.bytes || data.some(Number.isNaN)) return null;
      return def.decode(data);
    }
  }
  return null;
}
