/** SpaceNet support gate. No guests. No unpaid. Owner always in. */
const SB = "https://lkoatrkhuigdolnjsbie.supabase.co";
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.SB_ANON || '';
const PROJECT = "https://grok.com/project/ca0652ee-24d4-44d1-8a4b-65d41583532b";
const lastOpen = new Map();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Cache-Control", "no-store");
}
function architect() {
  return String(process.env.ARCHITECT_EMAIL || "notisastranov@gmail.com").toLowerCase();
}
function bearer(req) {
  var h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  var m = h.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : "";
}
async function userOf(req) {
  var t = bearer(req);
  if (!t || t.length < 20) return null;
  try {
    var r = await fetch(SB + "/auth/v1/user", {
      headers: { apikey: SB_ANON, Authorization: "Bearer " + t },
    });
    if (!r.ok) return null;
    var u = await r.json().catch(function () { return null; });
    if (!u || !u.email) return null;
    return u;
  } catch (_) {
    return null;
  }
}
function paid(u) {
  if (!u) return false;
  var email = String(u.email || "").toLowerCase();
  if (email && email === architect()) return true;
  var d = u.user_metadata || u.app_metadata || {};
  return d.paypal_paid === true || d.paypal_paid === "true" || !!d.paypal_capture;
}
function dirty(s) {
  return /javascript:|data:\s*text\/html|vbscript:|<script|onerror\s*=|eval\s*\(/i.test(String(s || ""));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  var u = await userOf(req);
  if (!u) {
    res.status(401).json({ ok: false, need: "login", error: "Sign in with Google first." });
    return;
  }
  if (!paid(u)) {
    res.status(403).json({
      ok: false,
      need: "paypal",
      error: "Support opens after one verified PayPal payment on this account.",
      email: u.email,
    });
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({ ok: true, allowed: true, email: u.email, owner: String(u.email).toLowerCase() === architect() });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }
  var id = String(u.id || u.email);
  var now = Date.now();
  var prev = lastOpen.get(id) || 0;
  if (now - prev < 120000) {
    res.status(429).json({ ok: false, error: "Wait a minute before opening support again." });
    return;
  }
  lastOpen.set(id, now);
  var ticket = "t" + now.toString(36) + Math.random().toString(36).slice(2, 6);
  var bits = [
    "SpaceNet SUPPORT " + ticket,
    "email " + String(u.email || ""),
    "uid " + String(u.id || "").slice(0, 12),
    new Date().toISOString(),
  ];
  if (dirty(bits.join(" "))) {
    res.status(400).json({ ok: false, error: "rejected" });
    return;
  }
  res.status(200).json({
    ok: true,
    ticket: ticket,
    url: PROJECT + "?q=" + encodeURIComponent(bits.join(" | ")),
  });
};
