import type { ZoomLevel } from "@/lib/types";

/**
 * Globe continuum camera heights (metres above ellipsoid).
 * far galaxy/stars → global → national → city streets → plot/Architect.
 */
export const CONTINUUM_HEIGHT: Record<ZoomLevel, number> = {
  galaxy: 4.2e7,
  global: 1.8e7,
  national: 2.4e6,
  city: 8.5e3,
  plot: 650,
};

export function levelFromHeight(heightM: number): ZoomLevel {
  if (heightM >= CONTINUUM_HEIGHT.galaxy * 0.85) return "galaxy";
  if (heightM >= CONTINUUM_HEIGHT.global * 0.85) return "global";
  if (heightM >= CONTINUUM_HEIGHT.national * 0.7) return "national";
  if (heightM >= CONTINUUM_HEIGHT.city * 0.55) return "city";
  return "plot";
}

export const LEVEL_LABEL: Record<ZoomLevel, string> = {
  galaxy: "Galaxy",
  global: "Global",
  national: "National",
  city: "City",
  plot: "Plot / Architect",
};
