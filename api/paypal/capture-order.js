const { cors, keyed, token, base } = require("./_lib");
const sbAnon = require("../../lib/sb-anon");

const SB_FALLBACK = "https://lkoatrkhuigdolnjsbie.supabase.co";

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

async function markPaid(req, cap, eur) {
  var auth = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  if (!/^Bearer\s+\S{20,}/i.test(auth)) return;
  var creds = await sbAnon.resolve();
  var anon = (creds && creds.anon) || "";
  var sb = (creds && creds.sb) || SB_FALLBACK;
  try {
    await fetch(sb + "/auth/v1/user", {
      method: "PUT",
      headers: {
        apikey: anon,
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          paypal_paid: true,
          paypal_capture: cap && cap.id,
          paypal_eur: eur,
          paypal_at: new Date().toISOString(),
        },
      }),
    });
  } catch (_) {}
  var svc = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!svc) return;
  try {
    var me = await fetch(sb + "/auth/v1/user", {
      headers: { apikey: anon || svc, Authorization: auth },
    });
    var user = await me.json().catch(function () { return {}; });
    var uid = user && user.id;
    if (!uid) return;
    await fetch(sb + "/rest/v1/rpc/avc_ledger_append", {
      method: "POST",
      headers: {
        apikey: svc,
        Authorization: "Bearer " + svc,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: uid,
        p_delta: eur,
        p_work_type: "paypal_reload",
        p_work_proof: { capture: cap && cap.id, eur: eur },
        p_public_note: "PayPal EUR → AV€",
      }),
    });
  } catch (_) {}
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
    var r = await fetch(base() + "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + t,
        "Content-Type": "application/json",
        "PayPal-Request-Id": "capture-" + orderId,
      },
    });
    var j = await r.json().catch(function () {
      return {};
    });
    var cap = firstCapture(j);
    if (!cap && r.status === 422) {
      var check = await fetch(base() + "/v2/checkout/orders/" + encodeURIComponent(orderId), {
        headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      });
      if (check.ok) {
        j = await check.json().catch(function () { return {}; });
        cap = firstCapture(j);
      }
    }
    var value = cap && cap.amount && cap.amount.value;
    var eur = Math.round(Number(value || body.amount || 0) * 100) / 100;
    if (!cap || String(cap.status || "").toUpperCase() !== "COMPLETED" || (cap.amount && cap.amount.currency_code !== "EUR")) {
      res.status(502).json({ error: j.message || "capture_failed", details: j });
      return;
    }
    await markPaid(req, cap, eur);
    res.status(200).json({
      ok: true,
      orderId: j.id || orderId,
      captureId: cap.id,
      eur: eur,
      avc: eur,
      pool_delta: eur,
      status: cap.status,
      paid: true,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
