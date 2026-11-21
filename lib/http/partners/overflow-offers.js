var auth = require("../../partners/auth");
var types = require("../../../js/spacenet/partners/types");

/**
 * POST /api/partners/overflow-offers
 * Platform pushes overflow offers to Astranov drivers when their fleet is exhausted.
 * Coexists with direct vendor path; typically vendor_type=delivery_services.
 */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }
  var gate = auth.authorize(req);
  if (!gate.ok) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }
  if (!auth.flagOn("ASTRANOV_OVERFLOW_ENABLED")) {
    res.status(403).json({ ok: false, error: "overflow_disabled", env: "ASTRANOV_OVERFLOW_ENABLED" });
    return;
  }

  var body = auth.readBody(req);
  body.source = "platform_overflow";
  if (!body.vendor_type) body.vendor_type = "delivery_services";
  var idem = auth.idempotencyKey(req, body);
  var prior = auth.recallIdempotent("ovf:" + idem);
  if (prior) {
    res.status(200).json(Object.assign({ ok: true, idempotent: true }, prior.payload));
    return;
  }

  var order = types.normalizeOrder(Object.assign({}, body, { idempotency_key: idem || body.idempotency_key }));
  if (!order) {
    res.status(400).json({ ok: false, error: "invalid_offer" });
    return;
  }
  order.id = order.id || ("ovf_" + Date.now().toString(36));
  var out = {
    ok: true,
    stub: true,
    auth_mode: gate.mode,
    offer: order,
    route: "Astranov drivers with POWER ON · same offer UX (decline/accept + countdown)",
    city_account_id: order.city_account_id
  };
  auth.storeIdempotent("ovf:" + (idem || order.id), out);
  res.status(201).json(out);
};
