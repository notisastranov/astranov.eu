/** SpaceNet public listings. No fake shops. Device-local always wins if net is down. */
const sbAnon = require("../lib/sb-anon");

function cors(res, cache) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", cache || "no-store");
}

var memGet = { key: "", at: 0, body: null };
var CDN_GET = "public, s-maxage=60, stale-while-revalidate=300";
var CDN_EMPTY = "public, s-maxage=120, stale-while-revalidate=600";

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

function slim(row) {
  if (!row || typeof row !== "object") return null;
  const out = {};
  const keep = [
    "id",
    "kind",
    "lat",
    "lng",
    "name",
    "label",
    "text",
    "menu",
    "hours",
    "open",
    "phone",
    "note",
    "peer",
    "presence",
    "routes",
    "vehicles",
    "range",
    "carry",
    "pref",
    "street",
    "number",
    "floor",
    "bell",
    "bellName",
    "place",
    "raw",
    "t",
    "held",
    "status",
    "avc",
    "ride",
    "how",
    "query",
    "shop",
    "driver",
    "drop",
    "customerPeer",
    "holdMin",
    "flag",
    "strict",
    "cid",
    "pack",
    "want",
    "served",
    "fromPeer",
    "mesh",
  ];
  keep.forEach(function (k) {
    if (row[k] != null && row[k] !== "") out[k] = row[k];
  });
  ["cover", "profile", "photo", "menuPhotos", "sdp", "ice"].forEach(function (k) {
    delete out[k];
  });
  if (Array.isArray(out.pack)) {
    out.pack = out.pack.slice(0, 36).map(function (p) {
      if (!p || typeof p !== "object") return null;
      var o = {
        id: p.id,
        kind: p.kind || "shop",
        name: String(p.name || "").slice(0, 48),
        lat: Number(p.lat),
        lng: Number(p.lng),
      };
      if (p.phone) o.phone = String(p.phone).slice(0, 24);
      if (p.open != null) o.open = p.open;
      return o;
    }).filter(Boolean);
  }
  let json = JSON.stringify(out);
  if (json.length > 120000) {
    delete out.pack;
    json = JSON.stringify(out);
  }
  if (json.length > 120000) return null;
  return out;
}

function stripBody(body) {
  if (!body || typeof body !== "object") return body || {};
  delete body.cover;
  delete body.profile;
  delete body.photo;
  delete body.menuPhotos;
  delete body.sdp;
  delete body.ice;
  return body;
}

async function sb(path, opt) {
  const creds = await sbAnon.resolve();
  const headers = Object.assign(
    {
      apikey: creds.anon || "",
      Authorization: "Bearer " + (creds.anon || ""),
      "Content-Type": "application/json",
    },
    (opt && opt.headers) || {}
  );
  const r = await fetch(creds.sb + "/rest/v1/" + path, Object.assign({}, opt, { headers }));
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { ok: r.ok, status: r.status, json: json, text: text };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method === "HEAD") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    const q = req.query || {};
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
      cors(res, CDN_EMPTY);
      res.status(200).json({
        ok: true,
        local: false,
        need: "gps",
        shops: [],
        drops: [],
        drivers: [],
        posts: [],
        jobs: [],
        peers: [],
      });
      return;
    }
    const memKey = lat.toFixed(2) + "," + lng.toFixed(2);
    if (memGet.body && memGet.key === memKey && Date.now() - memGet.at < 60000) {
      cors(res, CDN_GET);
      res.status(200).json(memGet.body);
      return;
    }
    const creds = await sbAnon.resolve();
    if (!creds.anon || creds.anon.length <= 20) {
      res.status(200).json({
        ok: false,
        local: true,
        status: 401,
        why: "no-anon",
        shops: [],
        drops: [],
        drivers: [],
        posts: [],
        jobs: [],
      });
      return;
    }
    const got = await sb(
      "sn_listings?select=id,kind,lat,lng,body,updated_at&order=updated_at.desc&limit=80"
    );
    if (!got.ok) {
      res.status(200).json({
        ok: false,
        local: true,
        status: got.status,
        shops: [],
        drops: [],
        drivers: [],
        posts: [],
        jobs: [],
      });
      return;
    }
    const buckets = { shops: [], drops: [], drivers: [], posts: [], jobs: [], peers: [] };
    (got.json || []).forEach(function (row) {
      const body = stripBody(row.body || {});
      body.id = body.id || row.id;
      body.kind = body.kind || row.kind;
      body.lat = Number(body.lat != null ? body.lat : row.lat);
      body.lng = Number(body.lng != null ? body.lng : row.lng);
      if (!isFinite(body.lat) || !isFinite(body.lng)) return;
      if (body.kind === "drop" || body.secret) return;
      if (isFinite(lat) && isFinite(lng)) {
        const dLat = ((body.lat - lat) * Math.PI) / 180;
        const dLng = ((body.lng - lng) * Math.PI) / 180;
        const x =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((body.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const km = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
        if (km > 80) return;
      }
      const k =
        body.kind === "shop"
          ? "shops"
          : body.kind === "driver"
            ? "drivers"
            : body.kind === "post"
              ? "posts"
              : body.kind === "job"
                ? "jobs"
                : body.kind === "peer"
                  ? "peers"
                  : "";
      if (k === "jobs" && body.drop) {
        const peer = String(q.peer || "");
        const allow =
          peer && ((body.driver && body.driver.peer === peer) || body.customerPeer === peer);
        if (!allow) delete body.drop;
      }
      if (k) buckets[k].push(body);
    });
    const out = Object.assign({ ok: true, local: false }, buckets);
    memGet = { key: memKey, at: Date.now(), body: out };
    cors(res, CDN_GET);
    res.status(200).json(out);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }

  const body = readBody(req);
  const row = slim(body.row || body);
  if (row && (row.kind === "drop" || row.secret)) {
    res.status(200).json({ ok: true, local: true, secret: true });
    return;
  }
  if (!row || !row.id || !row.kind || !isFinite(Number(row.lat))) {
    res.status(400).json({ ok: false, error: "row" });
    return;
  }
  const put = await sb("sn_listings?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: String(row.id).slice(0, 64),
      kind: String(row.kind).slice(0, 16),
      lat: Number(row.lat),
      lng: Number(row.lng),
      body: row,
      updated_at: new Date().toISOString(),
    }),
  });
  res.status(200).json({ ok: put.ok, local: !put.ok, status: put.status });
};
