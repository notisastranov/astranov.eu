/**
 * Decode Mode 09 PID 02 (VIN) response into the 17-character ASCII VIN.
 * The ELM may stitch multi-frame responses for us; we just strip everything
 * non-hex, walk past the 49 02 NN header, and ASCII-decode the rest.
 */

export function parseVin(frames: string[]): string | null {
  const hex = frames.join(" ").replace(/[^0-9A-Fa-f]/g, "");
  const idx = hex.toUpperCase().indexOf("4902");
  if (idx < 0) return null;
  // 4902 + 01 (number of data items) — skip 6 hex chars total
  const data = hex.slice(idx + 6);
  let vin = "";
  for (let i = 0; i + 1 < data.length; i += 2) {
    const code = parseInt(data.slice(i, i + 2), 16);
    if (code === 0) continue;
    if (code >= 0x20 && code < 0x7f) vin += String.fromCharCode(code);
  }
  return vin.length === 17 ? vin : vin.length > 17 ? vin.slice(0, 17) : null;
}
