var auth = require("../../partners/auth");
var crypto = require("crypto");

/** POST /api/partners/webhooks/test — echo + optional HMAC check. */
module.exports = async function handler(req, res) {
  auth.cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "method" }); return; }

  var body = auth.readBody(req);
  var secret = process.env.ASTRANOV_PARTNER_WEBHOOK_SECRET || "";
  var sig = (req.headers && (req.headers["x-astranov-signature"] || req.headers["X-Astranov-Signature"])) || "";
  var sigOk = null;
  if (secret && sig) {
    var raw = typeof req.body === "string" ? req.body : JSON.stringify(body);
    var expect = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    sigOk = sig === expect;
  }

  res.status(200).json({
    ok: true,
    stub: true,
    received: body,
    authorization_present: !!auth.bearer(req),
    signature_checked: sigOk !== null,
    signature_ok: sigOk,
    events: require("../../../js/spacenet/partners/types").WEBHOOK_EVENTS
  });
};
