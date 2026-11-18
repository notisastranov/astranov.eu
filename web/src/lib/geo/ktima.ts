/** Hellenic Cadastre / Rhodes geo hooks for the hub globe continuum. */

export const KTIMA_WMS = "https://gis.ktimanet.gr/wms/wmsopen/wmsserver.aspx";
export const KTIMA_LAYER = "BASEMAP";
export const KTIMA_HOME = "https://www.ktimatologio.gr";

export const GREECE_BBOX = {
  west: 19.153,
  south: 32.4,
  east: 31.962,
  north: 41.625,
};

export const RHODES = { lat: 36.434, lon: 28.217 };

export type CadastreLayerMode = "off" | "greece" | "rhodes";

/**
 * Live Hellenic Cadastre WMS is out of scope for this MVP.
 * Layer switch stubs Greece / Rhodes framing only.
 */
export function describeCadastreStub(mode: CadastreLayerMode): string {
  switch (mode) {
    case "greece":
      return "Greece national frame stub (Ktimatologio WMS not live)";
    case "rhodes":
      return "Rhodes / Rodi frame stub — vault + ktima hooks ready";
    default:
      return "Cadastre overlay off";
  }
}
