/** Partner API key / idempotency helpers. No secrets hardcoded. */

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, idempotency-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function bearer(req) {
  var h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  var m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function idempotencyKey(req, body) {
  var h = (req.headers && (req.headers["idempotency-key"] || req.headers["Idempotency-Key"])) || "";
  if (h) return String(h).slice(0, 120);
  if (body && body.idempotency_key) return String(body.idempotency_key).slice(0, 120);
  if (body && body.external_id) return String(body.external_id).slice(0, 120);
  if (body && body.external_delivery_id) return String(body.external_delivery_id).slice(0, 120);
  return "";
}

/** Returns { ok, mode: "open"|"key"|"denied" }. Open when no keys configured (dev stub). */
function authorize(req) {
  var raw = process.env.ASTRANOV_PARTNER_API_KEYS || "";
  var keys = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (!keys.length) return { ok: true, mode: "open" };
  var tok = bearer(req);
  if (tok && keys.indexOf(tok) >= 0) return { ok: true, mode: "key" };
  return { ok: false, mode: "denied" };
}

function flagOn(name) {
  var v = String(process.env[name] || "").trim();
  return v === "1" || /^true$/i.test(v) || v === "";
}

/** In-memory idempotency for stub (process lifetime). */
var seen = Object.create(null);

function recallIdempotent(key) {
  if (!key) return null;
  return seen[key] || null;
}

function storeIdempotent(key, payload) {
  if (!key) return;
  seen[key] = { at: Date.now(), payload: payload };
}

module.exports = {
  readBody: readBody,
  cors: cors,
  bearer: bearer,
  idempotencyKey: idempotencyKey,
  authorize: authorize,
  flagOn: flagOn,
  recallIdempotent: recallIdempotent,
  storeIdempotent: storeIdempotent
};
