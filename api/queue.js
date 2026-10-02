/** Administrator approval queue. Rows live in Supabase so a reload does not drop them. */
const sbAnon = require("../lib/sb-anon");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Cache-Control", "no-store");
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function clip(v, n) {
  return String(v || "").slice(0, n);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const cfg = await sbAnon.resolve();
  if (!cfg.anon) {
    res.status(200).json({ ok: false, items: [], error: "supabase anon missing" });
    return;
  }
  const base = cfg.sb + "/rest/v1/sn_admin_queue";
  const headers = {
    apikey: cfg.anon,
    Authorization: "Bearer " + cfg.anon,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (req.method === "GET") {
    const r = await fetch(base + "?select=id,kind,title,note,who,role,ref,status,t&order=t.desc&limit=200", { headers });
    const items = await r.json();
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, items: Array.isArray(items) ? items : [] });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, items: [] });
    return;
  }
  const body = readBody(req);
  if (body.id && (body.status === "yes" || body.status === "no")) {
    const r = await fetch(base + "?id=eq." + encodeURIComponent(body.id), {
      method: "PATCH",
      headers: Object.assign({ Prefer: "return=representation" }, headers),
      body: JSON.stringify({ status: body.status }),
    });
    const items = await r.json();
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, items: Array.isArray(items) ? items : [] });
    return;
  }
  const src = body.item || {};
  if (!src.id) {
    res.status(400).json({ ok: false, items: [] });
    return;
  }
  const item = {
    id: clip(src.id, 80),
    kind: clip(src.kind || "ask", 24),
    title: clip(src.title || "Request", 80),
    note: clip(src.note, 240),
    who: clip(src.who, 80),
    role: clip(src.role, 24),
    ref: clip(src.ref, 80),
    status: src.status === "yes" || src.status === "no" ? src.status : "open",
    t: Number(src.t) || Date.now(),
  };
  const r = await fetch(base, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=representation" }, headers),
    body: JSON.stringify(item),
  });
  const items = await r.json();
  res.status(r.ok ? 200 : 502).json({ ok: r.ok, items: Array.isArray(items) ? items : [] });
};
