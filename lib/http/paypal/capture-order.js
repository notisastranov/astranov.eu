const { cors, keyed, token, base } = require("./_lib");
const wallet = require("./_wallet");

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

function firstCapture(j) {
  return j && j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments &&
    j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
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
  var orderId = String(body.orderId || body.token || "").trim();
  if (!/^[a-z0-9-]{8,64}$/i.test(orderId)) {
    res.status(400).json({ error: "missing_order" });
    return;
  }
  try {
    var t = await token();
    var endpoint = base() + "/v2/checkout/orders/" + encodeURIComponent(orderId);
    var check = await fetch(endpoint, { headers: { Authorization: "Bearer " + t } });
    if (!check.ok) return res.status(502).json({ error: "order_check_failed" });
    var j = await check.json();
    var binding = String(j.purchase_units?.[0]?.custom_id || "");
    var uid = null;
    if (binding.startsWith(wallet.depositPrefix)) {
      uid = await wallet.verifiedUser(req);
      if (!uid || binding !== wallet.depositPrefix + uid) return res.status(403).json({ error: "wallet_account_mismatch" });
      if (!await wallet.walletReady()) return res.status(503).json({ error: "wallet_unavailable" });
    } else if (body.wallet_topup === true) {
      return res.status(400).json({ error: "wallet_binding_missing" });
    }
    var cap = firstCapture(j);
    if (!cap) {
      var r = await fetch(endpoint + "/capture", {
        method: "POST",
        headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", "PayPal-Request-Id": "capture-" + orderId }
      });
      j = await r.json().catch(function () { return {}; });
      cap = firstCapture(j);
      if (!cap && r.status === 422) {
        var repeat = await fetch(endpoint, { headers: { Authorization: "Bearer " + t } });
        if (repeat.ok) { j = await repeat.json(); cap = firstCapture(j); }
      }
    }
    var cents = Math.round(Number(cap?.amount?.value) * 100);
    if (!cap || cap.status !== "COMPLETED" || cap.amount?.currency_code !== "EUR" || !Number.isInteger(cents) || cents <= 0) {
      return res.status(502).json({ error: "capture_failed" });
    }
    var credit = null;
    if (uid) {
      credit = await wallet.creditDeposit(uid, orderId, cap.id, cents);
      if (!credit) return res.status(503).json({ error: "wallet_credit_pending" });
    }
    var eur = cents / 100;
    res.status(200).json({
      ok: true,
      orderId: j.id || orderId,
      captureId: cap.id,
      eur: eur,
      avc: eur,
      pool_delta: eur,
      status: cap.status,
      paid: true,
      wallet: credit,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
