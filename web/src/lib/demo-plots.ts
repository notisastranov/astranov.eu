import type { Plot } from "@/lib/types";

/** Demo Rhodes plots for the hub MVP (not dummy shops / not live cadastre). */
export const DEMO_PLOTS: Plot[] = [
  {
    id: "plot-rhodes-analipsi",
    ownerId: null,
    name: "Análipsi ktima stub",
    ring: [
      { lat: 36.4318, lon: 28.2212 },
      { lat: 36.4326, lon: 28.2234 },
      { lat: 36.4314, lon: 28.2246 },
      { lat: 36.4306, lon: 28.2221 },
    ],
    centroid: { lat: 36.4316, lon: 28.2228 },
    areaM2: null,
    ktimaRef: "RHODES-STUB-001",
    nationCode: "GR",
    citySlug: "rhodes",
    createdAt: "2026-11-18T00:00:00.000Z",
  },
  {
    id: "plot-rhodes-oldtown",
    ownerId: null,
    name: "Rodi vault ring stub",
    ring: [
      { lat: 36.4432, lon: 28.2241 },
      { lat: 36.4441, lon: 28.226 },
      { lat: 36.4429, lon: 28.2271 },
      { lat: 36.442, lon: 28.225 },
    ],
    centroid: { lat: 36.44305, lon: 28.22555 },
    areaM2: null,
    ktimaRef: "VAULT-RODI-STUB",
    nationCode: "GR",
    citySlug: "rhodes",
    createdAt: "2026-11-18T00:00:00.000Z",
  },
];
