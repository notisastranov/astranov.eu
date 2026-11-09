const QUERY =
  "https://services-eu1.arcgis.com/40tFGWzosjaLJpmn/arcgis/rest/services/GEOTEMAXIA_LEITOURGOUN_ON_gdb/FeatureServer/0/query";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

module.exports = async function parcels(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const west = num(url.searchParams.get("west"));
  const south = num(url.searchParams.get("south"));
  const east = num(url.searchParams.get("east"));
  const north = num(url.searchParams.get("north"));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=120");
  if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "bad bbox", features: [] }));
    return;
  }
  if (east - west > 0.04 || north - south > 0.04) {
    res.end(JSON.stringify({ ok: true, reason: "zoom", features: [] }));
    return;
  }
  const target = new URL(QUERY);
  target.searchParams.set("f", "geojson");
  target.searchParams.set("where", "1=1");
  target.searchParams.set("geometry", west + "," + south + "," + east + "," + north);
  target.searchParams.set("geometryType", "esriGeometryEnvelope");
  target.searchParams.set("inSR", "4326");
  target.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  target.searchParams.set("outFields", "KAEK,AREA,DESCR");
  target.searchParams.set("returnGeometry", "true");
  target.searchParams.set("outSR", "4326");
  target.searchParams.set("resultRecordCount", "500");
  try {
    const upstream = await fetch(target);
    const body = await upstream.json();
    if (!upstream.ok || body.error) {
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, error: "cadastre parcels did not answer", features: [] }));
      return;
    }
    res.end(JSON.stringify({
      ok: true,
      features: Array.isArray(body.features) ? body.features.slice(0, 500) : [],
      exceeded: !!body.exceededTransferLimit,
    }));
  } catch {
    res.statusCode = 504;
    res.end(JSON.stringify({ ok: false, error: "cadastre parcels timed out", features: [] }));
  }
};
