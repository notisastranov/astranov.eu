/** SpaceNet support desk. Users never see the builder environment. */
const SB = "https://lkoatrkhuigdolnjsbie.supabase.co";
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.SB_ANON || "";
const lastOpen = new Map();
const tickets = new Map();

const SUPPORT_SYS =
  "You are the Astranov SpaceNet support desk on astranov.eu. " +
  "Speak like a calm person on the line. One to three sentences. " +
  "You take the ticket. You can explain how the globe, orders, wallet, login, power hold, and GO/MIC work. " +
  "You cannot edit the live app, open a repo, run tools, or hand the user a builder, agent, or project URL. " +
  "Never mention GrokBuild, Cursor, GitHub, Vercel, Supabase project ids, or internal agents. " +
  "If they report a break, acknowledge, give ticket tone, say the architect will take it. " +
  "English default; Greek if they write Greek. No JSON. No markdown.";

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
function dirty(s) {
  return /javascript:|data:\s*text\/html|vbscript:|<script|onerror\s*=|eval\s*\(/i.test(String(s || ""));
}
function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}
function pullText(j) {
  if (!j) return "";
  if (j.output_text) return String(j.output_text);
  var t = "";
  (j.output || []).forEach(function (o) {
    if (!o) return;
    var c = o.content || (o.message && o.message.content);
    if (typeof c === "string") t += c;
    else (c || []).forEach(function (p) { t += (p && (p.text || p.output_text || "")) || ""; });
  });
  if (!t && j.choices && j.choices[0] && j.choices[0].message) t = j.choices[0].message.content || "";
  return String(t || "").trim();
}
async function deskReply(matter, email) {
  var key = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
  if (!key) return "";
  try {
    var r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || "grok-4",
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: "system", content: SUPPORT_SYS },
          { role: "user", content: "From " + email + ":\n" + matter },
        ],
      }),
    });
    var j = await r.json().catch(function () { return {}; });
    return pullText(j).replace(/https?:\/\/\S+/g, "").slice(0, 500);
  } catch (_) {
    return "";
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  var u = await userOf(req);
  if (!u) {
    res.status(401).json({ ok: false, need: "login", error: "Sign in first." });
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      desk: true,
      email: u.email,
      owner: String(u.email).toLowerCase() === architect(),
    });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }
  var id = String(u.id || u.email);
  var now = Date.now();
  var prev = lastOpen.get(id) || 0;
  if (now - prev < 4000) {
    res.status(429).json({ ok: false, error: "Wait a moment." });
    return;
  }
  var body = readBody(req);
  var matter = String(body.matter || body.q || body.text || "").trim().slice(0, 2000);
  var name = String(body.name || (u.user_metadata && u.user_metadata.full_name) || u.email || "").trim().slice(0, 80);
  if (!matter) {
    res.status(400).json({ ok: false, error: "Say what you need." });
    return;
  }
  if (dirty(matter) || dirty(name)) {
    res.status(400).json({ ok: false, error: "rejected" });
    return;
  }
  lastOpen.set(id, now);
  var ticket = body.ticket || ("t" + now.toString(36) + Math.random().toString(36).slice(2, 6));
  var row = tickets.get(ticket) || { ticket: ticket, email: u.email, name: name, lines: [] };
  row.lines.push({ at: new Date().toISOString(), from: "user", text: matter });
  var say = await deskReply(matter, u.email);
  if (!say) say = "Got it. Ticket " + ticket + ". Stay on this line — the desk has the note.";
  row.lines.push({ at: new Date().toISOString(), from: "desk", text: say });
  tickets.set(ticket, row);
  res.status(200).json({
    ok: true,
    ticket: ticket,
    say: say,
    desk: true,
  });
};
