const { cors, keyed, token, base } = require("./_lib");

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

function returnOrigin(raw) {
  try {
    var u = new URL(String(raw || "https://astranov.eu"));
    if (u.protocol === "https:" && (u.hostname === "astranov.eu" || u.hostname.endsWith(".astranov.eu"))) {
      return u.origin;
    }
  } catch (_) {}
  return "https://astranov.eu";
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST" });
    return;
  }
  if (!keyed()) {
    res.status(503).json({ error: "paypal_not_configured" });
    return;
  }
  var body = readBody(req);
  var requested = Number(body.amount || body.eur || 10);
  if (!Number.isFinite(requested) || requested < 1 || requested > 50000) {
    res.status(400).json({ error: "invalid_amount" });
    return;
  }
  var amount = Math.round(requested * 100) / 100;
  var origin = returnOrigin(body.origin);
  var reference = String(body.reference || "AVC deposit").replace(/[\r\n]/g, " ").slice(0, 80);
  try {
    var t = await token();
    var r = await fetch(base() + "/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + t,
        "Content-Type": "application/json",
        "PayPal-Request-Id": "sn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: "avc-deposit",
            description: "Astranov AVC deposit · " + reference,
            amount: { currency_code: "EUR", value: amount.toFixed(2) },
          },
        ],
        application_context: {
          brand_name: "Astranov SpaceNet",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          return_url: origin + "/?paypal=success",
          cancel_url: origin + "/?paypal=cancel",
        },
      }),
    });
    var j = await r.json().catch(function () {
      return {};
    });
    var approve = (j.links || []).find(function (l) {
      return l && l.rel === "approve";
    });
    if (!r.ok || !j.id) {
      res.status(502).json({ error: j.message || j.error || "create_failed", details: j });
      return;
    }
    res.status(200).json({
      ok: true,
      orderId: j.id,
      amount: amount,
      approve: approve && approve.href,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
