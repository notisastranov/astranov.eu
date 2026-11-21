var auth = require("../../partners/auth");

/** PUT /api/vendors/direct/:id/menu — product menu or delivery SKUs. */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "PUT" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }
  if (!auth.flagOn("ASTRANOV_VENDOR_DIRECT_ENABLED")) {
    res.status(403).json({ ok: false, error: "direct_vendor_disabled" });
    return;
  }

  var body = auth.readBody(req);
  var id = String(body.id || "").slice(0, 80);
  if (!id) {
    try {
      var m = String(req.url || "").match(/\/direct\/([^/]+)\/menu/);
      if (m) id = decodeURIComponent(m[1]);
    } catch (_) {}
  }
  if (!id) { res.status(400).json({ ok: false, error: "missing_id" }); return; }

  var items = Array.isArray(body.items) ? body.items : (Array.isArray(body.menu) ? body.menu : []);
  var normalized = items.slice(0, 100).map(function (it, i) {
    return {
      i: i,
      name: String(it.name || ("Item " + (i + 1))).slice(0, 120),
      price: Number(it.price) || (Number(it.price_cents) || 0) / 100,
      note: String(it.note || it.desc || "").slice(0, 240),
      hours: String(it.hours || it.availability || "").slice(0, 80),
      stock: String(it.stock || "in").slice(0, 24),
      sku_kind: String(it.sku_kind || it.kind || "product").slice(0, 40)
    };
  });

  res.status(200).json({
    ok: true,
    stub: true,
    id: id,
    items: normalized,
    hint: "For delivery_services vendors, items are delivery SKUs (zones/rates), not food."
  });
};
