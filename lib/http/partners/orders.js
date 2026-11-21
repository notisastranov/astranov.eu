var auth = require("../../partners/auth");
var types = require("../../../js/spacenet/partners/types");

/** POST /api/partners/orders — partner pushes order/offer into Astranov. */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }
  var gate = auth.authorize(req);
  if (!gate.ok) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }

  var body = auth.readBody(req);
  var idem = auth.idempotencyKey(req, body);
  var prior = auth.recallIdempotent("ord:" + idem);
  if (prior) {
    res.status(200).json(Object.assign({ ok: true, idempotent: true }, prior.payload));
    return;
  }

  var order = types.normalizeOrder(Object.assign({}, body, { idempotency_key: idem || body.idempotency_key }));
  if (!order) {
    res.status(400).json({ ok: false, error: "invalid_order", hint: "need external_id or Idempotency-Key, valid status, vendor/dropoff coords preferred" });
    return;
  }
  order.id = order.id || ("ord_" + Date.now().toString(36));
  var out = {
    ok: true,
    stub: true,
    auth_mode: gate.mode,
    order: order,
    next: "Drivers with POWER ON receive offers when routed; status via POST /api/partners/orders/" + order.id + "/status"
  };
  auth.storeIdempotent("ord:" + (idem || order.id), out);
  res.status(201).json(out);
};
