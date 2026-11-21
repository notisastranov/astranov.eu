var auth = require("../../partners/auth");
var types = require("../../../js/spacenet/partners/types");

/**
 * POST /api/vendors/direct — vendor connects to Astranov with no DoorDash/DH.
 * vendor_type: vendor (products) | delivery_services (same map UX).
 */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }
  if (!auth.flagOn("ASTRANOV_VENDOR_DIRECT_ENABLED")) {
    res.status(403).json({ ok: false, error: "direct_vendor_disabled", env: "ASTRANOV_VENDOR_DIRECT_ENABLED" });
    return;
  }

  var body = auth.readBody(req);
  var name = String(body.name || "").trim().slice(0, 120);
  var lat = Number(body.lat);
  var lng = Number(body.lng != null ? body.lng : body.lon);
  if (!name || !isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ ok: false, error: "name_lat_lng_required" });
    return;
  }
  var vtype = types.normalizeVendorType(body.vendor_type || body.type || "vendor");
  var idem = auth.idempotencyKey(req, body);
  var prior = auth.recallIdempotent("dv:" + idem);
  if (prior) {
    res.status(200).json(Object.assign({ ok: true, idempotent: true }, prior.payload));
    return;
  }

  var vendor = {
    id: String(body.id || ("vnd_" + Date.now().toString(36))).slice(0, 80),
    name: name,
    lat: lat,
    lng: lng,
    vendor_type: vtype,
    kind: vtype,
    role: vtype === "delivery_services" ? "delivery_services" : "vendor",
    gbp: String(body.gbp || "").slice(0, 240),
    phone: String(body.phone || "").slice(0, 40),
    source: "direct_vendor",
    listable: true
  };
  var out = {
    ok: true,
    stub: true,
    vendor: vendor,
    ux: "Same stamp insert/verify/menu pattern as restaurant vendors; delivery_services sells delivery SKUs not products."
  };
  auth.storeIdempotent("dv:" + (idem || vendor.id), out);
  res.status(201).json(out);
};
