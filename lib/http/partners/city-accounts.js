var auth = require("../../partners/auth");
var types = require("../../../js/spacenet/partners/types");

/**
 * POST /api/partners/city-accounts
 * Platforms with vendor contracts (e.g. DoorDash) register a city / virtual office
 * listed as vendor_type delivery_services — same map UX as restaurant vendors.
 */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }
  var gate = auth.authorize(req);
  if (!gate.ok) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }

  var body = auth.readBody(req);
  var idem = auth.idempotencyKey(req, body);
  var prior = auth.recallIdempotent("city:" + idem);
  if (prior) {
    res.status(200).json(Object.assign({ ok: true, idempotent: true }, prior.payload));
    return;
  }

  var account = types.normalizeCityAccount(body);
  if (!account) {
    res.status(400).json({ ok: false, error: "invalid_city_account", hint: "name + lat + lng required" });
    return;
  }
  account.id = account.id || ("city_" + Date.now().toString(36));
  var out = {
    ok: true,
    stub: true,
    auth_mode: gate.mode,
    account: account,
    map: {
      listable: true,
      vendor_type: "delivery_services",
      ux: "same as restaurant vendor — profile + delivery SKU menu"
    },
    overflow: {
      endpoint: "POST /api/partners/overflow-offers",
      when: "platform short on drivers"
    }
  };
  auth.storeIdempotent("city:" + (idem || account.id), out);
  res.status(201).json(out);
};
