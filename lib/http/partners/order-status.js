var auth = require("../../partners/auth");
var types = require("../../../js/spacenet/partners/types");

/** POST /api/partners/orders/:id/status — lifecycle update. */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }
  var gate = auth.authorize(req);
  if (!gate.ok) { res.status(401).json({ ok: false, error: "unauthorized" }); return; }

  var body = auth.readBody(req);
  var id = String((body && body.id) || "").slice(0, 80);
  if (!id) {
    var key = "";
    try {
      var raw = String((req && req.url) || "");
      var m = raw.match(/\/orders\/([^/]+)\/status/);
      if (m) id = decodeURIComponent(m[1]);
    } catch (_) {}
  }
  if (!id) { res.status(400).json({ ok: false, error: "missing_id" }); return; }

  var status = types.normalizeStatus(body.status);
  if (!status) {
    res.status(400).json({ ok: false, error: "bad_status", allowed: types.ORDER_STATUSES });
    return;
  }
  res.status(200).json({
    ok: true,
    stub: true,
    id: id,
    status: status,
    reason: body.reason ? String(body.reason).slice(0, 240) : undefined,
    auth_mode: gate.mode
  });
};
