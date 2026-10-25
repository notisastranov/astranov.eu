/**
 * DTC encode/decode and a small built-in dictionary of the most common
 * generic powertrain codes (SAE J2012). Manufacturer-specific codes
 * resolve via the AI route at request time.
 */

export interface DtcInfo {
  code: string;
  description: string;
  system: "powertrain" | "chassis" | "body" | "network";
  generic: boolean;
}

const PREFIX = ["P", "C", "B", "U"] as const;

/**
 * Decode a 2-byte DTC payload into the canonical "P0301" form.
 * First two bits of byte A select prefix + generic/manufacturer, lower
 * 14 bits are the hex code.
 */
export function decodeDtc(a: number, b: number): string {
  const prefix = PREFIX[(a >> 6) & 0b11];
  const second = ((a >> 4) & 0b11).toString();
  const third = (a & 0x0f).toString(16).toUpperCase();
  const fourth = ((b >> 4) & 0x0f).toString(16).toUpperCase();
  const fifth = (b & 0x0f).toString(16).toUpperCase();
  return `${prefix}${second}${third}${fourth}${fifth}`;
}

/**
 * Parse Mode 03 ("43") response frames into DTC strings.
 * Frames may span multiple lines; ISO 15765 stitches them server-side
 * via the ELM driver, so by the time we get here it's "43 NN AA BB CC DD..."
 */
export function parseDtcResponse(frames: string[]): string[] {
  const flat = frames.join(" ").replace(/[^0-9A-Fa-f ]/g, "").trim();
  const tokens = flat.split(/\s+/).filter(Boolean).map((t) => t.toUpperCase());
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "43") continue;
    // ISO 15765 returns a count byte first, CAN does not — handle both.
    let cursor = i + 1;
    if (tokens[cursor] && tokens[cursor].length === 2 && parseInt(tokens[cursor], 16) <= 0x0F) {
      cursor += 1;
    }
    while (cursor + 1 < tokens.length) {
      const a = parseInt(tokens[cursor], 16);
      const b = parseInt(tokens[cursor + 1], 16);
      if (Number.isNaN(a) || Number.isNaN(b)) break;
      if (a === 0 && b === 0) break;
      out.push(decodeDtc(a, b));
      cursor += 2;
    }
    i = cursor - 1;
  }
  return Array.from(new Set(out));
}

/**
 * Minimal high-frequency code dictionary so the UI can render meaningful
 * descriptions without a round trip. Anything not here flows through the
 * AI explanation route, which is the better answer anyway for context.
 */
export const COMMON_DTCS: Record<string, DtcInfo> = {
  P0100: { code: "P0100", description: "Mass or Volume Air Flow Circuit Malfunction", system: "powertrain", generic: true },
  P0101: { code: "P0101", description: "MAF Sensor Circuit Range/Performance", system: "powertrain", generic: true },
  P0102: { code: "P0102", description: "MAF Sensor Circuit Low Input", system: "powertrain", generic: true },
  P0103: { code: "P0103", description: "MAF Sensor Circuit High Input", system: "powertrain", generic: true },
  P0107: { code: "P0107", description: "MAP/BARO Pressure Circuit Low Input", system: "powertrain", generic: true },
  P0108: { code: "P0108", description: "MAP/BARO Pressure Circuit High Input", system: "powertrain", generic: true },
  P0112: { code: "P0112", description: "IAT Sensor Circuit Low Input", system: "powertrain", generic: true },
  P0113: { code: "P0113", description: "IAT Sensor Circuit High Input", system: "powertrain", generic: true },
  P0117: { code: "P0117", description: "ECT Sensor Circuit Low Input", system: "powertrain", generic: true },
  P0118: { code: "P0118", description: "ECT Sensor Circuit High Input", system: "powertrain", generic: true },
  P0121: { code: "P0121", description: "TPS/Pedal Position Range/Performance", system: "powertrain", generic: true },
  P0122: { code: "P0122", description: "TPS/Pedal Position Low Input", system: "powertrain", generic: true },
  P0123: { code: "P0123", description: "TPS/Pedal Position High Input", system: "powertrain", generic: true },
  P0128: { code: "P0128", description: "Coolant Thermostat below regulating temperature", system: "powertrain", generic: true },
  P0130: { code: "P0130", description: "O2 Sensor Circuit Bank 1 Sensor 1", system: "powertrain", generic: true },
  P0131: { code: "P0131", description: "O2 Sensor Low Voltage Bank 1 Sensor 1", system: "powertrain", generic: true },
  P0133: { code: "P0133", description: "O2 Sensor Slow Response Bank 1 Sensor 1", system: "powertrain", generic: true },
  P0135: { code: "P0135", description: "O2 Sensor Heater Circuit Bank 1 Sensor 1", system: "powertrain", generic: true },
  P0171: { code: "P0171", description: "System Too Lean (Bank 1)", system: "powertrain", generic: true },
  P0172: { code: "P0172", description: "System Too Rich (Bank 1)", system: "powertrain", generic: true },
  P0174: { code: "P0174", description: "System Too Lean (Bank 2)", system: "powertrain", generic: true },
  P0175: { code: "P0175", description: "System Too Rich (Bank 2)", system: "powertrain", generic: true },
  P0200: { code: "P0200", description: "Injector Circuit Malfunction", system: "powertrain", generic: true },
  P0300: { code: "P0300", description: "Random/Multiple Cylinder Misfire Detected", system: "powertrain", generic: true },
  P0301: { code: "P0301", description: "Cylinder 1 Misfire Detected", system: "powertrain", generic: true },
  P0302: { code: "P0302", description: "Cylinder 2 Misfire Detected", system: "powertrain", generic: true },
  P0303: { code: "P0303", description: "Cylinder 3 Misfire Detected", system: "powertrain", generic: true },
  P0304: { code: "P0304", description: "Cylinder 4 Misfire Detected", system: "powertrain", generic: true },
  P0305: { code: "P0305", description: "Cylinder 5 Misfire Detected", system: "powertrain", generic: true },
  P0306: { code: "P0306", description: "Cylinder 6 Misfire Detected", system: "powertrain", generic: true },
  P0307: { code: "P0307", description: "Cylinder 7 Misfire Detected", system: "powertrain", generic: true },
  P0308: { code: "P0308", description: "Cylinder 8 Misfire Detected", system: "powertrain", generic: true },
  P0325: { code: "P0325", description: "Knock Sensor 1 Circuit (Bank 1)", system: "powertrain", generic: true },
  P0335: { code: "P0335", description: "Crankshaft Position Sensor Circuit", system: "powertrain", generic: true },
  P0340: { code: "P0340", description: "Camshaft Position Sensor Circuit", system: "powertrain", generic: true },
  P0401: { code: "P0401", description: "EGR Flow Insufficient Detected", system: "powertrain", generic: true },
  P0402: { code: "P0402", description: "EGR Flow Excessive Detected", system: "powertrain", generic: true },
  P0420: { code: "P0420", description: "Catalyst System Efficiency Below Threshold (Bank 1)", system: "powertrain", generic: true },
  P0430: { code: "P0430", description: "Catalyst System Efficiency Below Threshold (Bank 2)", system: "powertrain", generic: true },
  P0440: { code: "P0440", description: "Evaporative Emission System Malfunction", system: "powertrain", generic: true },
  P0442: { code: "P0442", description: "EVAP Small Leak Detected", system: "powertrain", generic: true },
  P0455: { code: "P0455", description: "EVAP Large Leak Detected", system: "powertrain", generic: true },
  P0500: { code: "P0500", description: "Vehicle Speed Sensor Malfunction", system: "powertrain", generic: true },
  P0505: { code: "P0505", description: "Idle Control System Malfunction", system: "powertrain", generic: true },
  P0606: { code: "P0606", description: "ECM/PCM Processor Fault", system: "powertrain", generic: true },
  P0700: { code: "P0700", description: "Transmission Control System Malfunction", system: "powertrain", generic: true },
};

export function lookupDtc(code: string): DtcInfo | null {
  return COMMON_DTCS[code.toUpperCase()] ?? null;
}
