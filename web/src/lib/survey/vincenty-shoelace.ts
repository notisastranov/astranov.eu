/**
 * Survey math stubs for Architect / forensic topo.
 *
 * Full Vincenty inverse + local-tangent shoelace live in architect CAD
 * (`architect/src/lib/cad/survey-math.ts`). This hub MVP keeps the
 * contracts and comments so plot area / edge length can plug in later
 * without inventing production numbers.
 *
 * TODO: wire real WGS84 Vincenty + shoelace when CAD polish lands.
 * Out of scope for this MVP: IGM georef collage, production ledger geometry.
 */

import type { GeoPoint } from "@/lib/types";

export interface SegmentMath {
  metres: number;
  bearingDeg: number;
  method: "vincenty-stub" | "haversine-stub";
}

export interface ParcelArea {
  m2: number;
  hectares: number;
  method: "shoelace-stub";
}

/** Vincenty inverse on WGS84 — STUB. Returns null until survey kernel is ported. */
export function vincentyDistance(_a: GeoPoint, _b: GeoPoint): SegmentMath | null {
  // TODO(survey): port geodesic() Vincenty from Architect survey-math.
  // Do not invent parcel lengths for court / cadastre use.
  return null;
}

/** Local tangent-plane shoelace — STUB. Accurate for a parcel, not a country. */
export function shoelaceArea(_ring: GeoPoint[]): ParcelArea | null {
  // TODO(survey): port parcelArea() shoelace from Architect survey-math.
  return null;
}

/** Convenience: try stubs, else leave Plot.areaM2 null. */
export function estimatePlotArea(ring: GeoPoint[]): number | null {
  const area = shoelaceArea(ring);
  return area?.m2 ?? null;
}
