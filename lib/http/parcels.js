const QUERY =
  "https://services-eu1.arcgis.com/40tFGWzosjaLJpmn/arcgis/rest/services/GEOTEMAXIA_LEITOURGOUN_ON_gdb/FeatureServer/0/query";

const PAGE = 500;
const MAX_FEATURES = 2000;
const BUDGET_MS = 8000;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function fetchPage(bbox, offset, signal) {
  const target = new URL(QUERY);
  target.searchParams.set("f", "geojson");
  target.searchParams.set("where", "1=1");
  target.searchParams.set("geometry", bbox);
  target.searchParams.set("geometryType", "esriGeometryEnvelope");
  target.searchParams.set("inSR", "4326");
  target.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  target.searchParams.set("outFields", "KAEK,AREA,DESCR");
  target.searchParams.set("returnGeometry", "true");
  target.searchParams.set("outSR", "4326");
  target.searchParams.set("resultRecordCount", String(PAGE));
  if (offset > 0) target.searchParams.set("resultOffset", String(offset));
  const upstream = await fetch(target, { signal });
  const body = await upstream.json();
  if (!upstream.ok || body.error) {
    const err = new Error("cadastre parcels did not answer");
    err.status = 502;
    throw err;
  }
  return {
    features: Array.isArray(body.features) ? body.features : [],
    exceeded: !!body.exceededTransferLimit,
  };
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
    res.end(JSON.stringify({ ok: false, error: "bad bbox", features: [], truncated: false, pages: 0 }));
    return;
  }
  if (east - west > 0.04 || north - south > 0.04) {
    res.end(JSON.stringify({
      ok: true,
      reason: "zoom",
      message: "Zoom in to see all parcels",
      features: [],
      truncated: true,
      pages: 0,
    }));
    return;
  }
  const bbox = west + "," + south + "," + east + "," + north;
  const started = Date.now();
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ac ? setTimeout(function () { try { ac.abort(); } catch (e) {} }, BUDGET_MS) : null;
  const features = [];
  let pages = 0;
  let exceeded = false;
  let truncated = false;
  let timedOut = false;
  try {
    let offset = 0;
    for (;;) {
      if (Date.now() - started >= BUDGET_MS) {
        timedOut = true;
        truncated = true;
        break;
      }
      const page = await fetchPage(bbox, offset, ac ? ac.signal : undefined);
      pages += 1;
      const got = page.features.length;
      for (let i = 0; i < got && features.length < MAX_FEATURES; i++) {
        features.push(page.features[i]);
      }
      // This cadastre layer often omits exceededTransferLimit in geojson;
      // a full PAGE means there may be more — keep paging until a short page.
      const fullPage = got >= PAGE;
      if (page.exceeded) exceeded = true;
      if (fullPage) exceeded = true;
      if (features.length >= MAX_FEATURES && fullPage) {
        truncated = true;
        break;
      }
      if (!fullPage) break;
      if (got === 0) break;
      offset += got;
      if (offset >= MAX_FEATURES) {
        truncated = true;
        break;
      }
    }
    if (timer) clearTimeout(timer);
    res.end(JSON.stringify({
      ok: true,
      features: features,
      pages: pages,
      truncated: truncated,
      exceeded: exceeded,
      reason: truncated ? "zoom" : undefined,
      message: truncated ? "Zoom in to see all parcels" : undefined,
      timedOut: timedOut || undefined,
    }));
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e && (e.name === "AbortError" || timedOut)) {
      res.end(JSON.stringify({
        ok: true,
        features: features,
        pages: pages,
        truncated: true,
        exceeded: exceeded,
        reason: "zoom",
        message: "Zoom in to see all parcels",
        timedOut: true,
      }));
      return;
    }
    res.statusCode = (e && e.status) || 504;
    res.end(JSON.stringify({
      ok: false,
      error: (e && e.message) || "cadastre parcels timed out",
      features: features,
      pages: pages,
      truncated: false,
    }));
  }
};
