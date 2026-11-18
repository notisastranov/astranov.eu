/**
 * AI → ArchitectCanvas mapping stubs.
 *
 * Natural-language commands from AICommandBar should resolve into canvas
 * ops (draw wall, set units, fly Rhodes, open vault audit, start site film).
 * This file documents the contract; execution is stubbed for the MVP.
 *
 * TODO: full CAD command polish + site-film encoder.
 */

export type CanvasOp =
  | { op: "setTool"; tool: "line" | "wall" | "rect" | "polyline" | "dim" }
  | { op: "flyTo"; lat: number; lon: number; label?: string }
  | { op: "layer"; layer: "osm" | "ktima" | "greece" | "rhodes" }
  | { op: "vaultAudit" }
  | { op: "siteFilm" }
  | { op: "status"; message: string }
  | { op: "noop"; reason: string };

export interface AiCanvasMapping {
  raw: string;
  ops: CanvasOp[];
}

/** Map a free-text AI / command-bar line into canvas ops (stub heuristics). */
export function mapAiToCanvas(raw: string): AiCanvasMapping {
  const t = raw.trim().toLowerCase();
  if (!t) return { raw, ops: [{ op: "noop", reason: "empty" }] };

  if (t === "rhodes" || t.includes("fly rhodes")) {
    return {
      raw,
      ops: [{ op: "flyTo", lat: 36.434, lon: 28.217, label: "Rhodes" }],
    };
  }
  if (t === "ktima" || t.includes("ktimatologio") || t.includes("cadastre")) {
    return {
      raw,
      ops: [
        { op: "layer", layer: "ktima" },
        {
          op: "status",
          message: "Hellenic Cadastre WMS stub — live WMS out of scope for MVP",
        },
      ],
    };
  }
  if (t === "vault" || t.includes("vault audit")) {
    return {
      raw,
      ops: [
        { op: "vaultAudit" },
        { op: "status", message: "Vault audit rings stub open" },
      ],
    };
  }
  if (t === "film" || t.includes("site film")) {
    return {
      raw,
      ops: [
        { op: "siteFilm" },
        { op: "status", message: "Site film stub — encoder TODO" },
      ],
    };
  }
  if (t === "wall" || t === "w") {
    return { raw, ops: [{ op: "setTool", tool: "wall" }] };
  }
  if (t === "line" || t === "l") {
    return { raw, ops: [{ op: "setTool", tool: "line" }] };
  }

  // TODO(ai): call /api/ai and map structured act:* payloads → CanvasOp[]
  return {
    raw,
    ops: [
      {
        op: "status",
        message: `AI→canvas stub received: “${raw.slice(0, 80)}”`,
      },
    ],
  };
}
