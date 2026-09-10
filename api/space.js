/** SpaceNet listings. Never download body (photos). Consume nothing without GPS or LOGIN. */
const sbAnon = require("../lib/sb-anon");

var CDN_GET = "public, max-age=60, s-maxage=120, stale-while-revalidate=600";
var CDN_EMPTY = "public, max-age=120, s-maxage=300, stale-while-revalidate=86400";
var memGet = { key: "", at: 0, body: null };
var SELECT =
  "id,kind,lat,lng,updated_at," +
  "name:body->>name,menu:body->>menu,phone:body->>phone,place:body->>place," +
  "hours:body->>hours,open:body->>open,status:body->>status,peer:body->>peer," +
  "street:body->>street,note:body->>note,raw:body->>raw," +
  "avc:body->avc,ride:body->ride,held:body->held,flag:body->>flag," +
  "presence:body->presence,routes:body->routes,vehicles:body->vehicles," +
  "shop:body->shop,query:body->>query,how:body->>how,holdMin:body->holdMin," +
  "strict:body->strict,customerPeer:body->>customerPeer";
var TEXT_KEYS = [
  "name",
  "menu",
  "phone",
  "place",
  "hours",
  "open",
  "status",
  "peer",
  "street",
  "note",
  "raw",
  "flag",
  "query",
  "how",
  "customerPeer",
];
var JSON_KEYS = ["avc", "ride", "held", "presence", "routes", "vehicles", "shop", "holdMin", "strict"];
var WRITE_KINDS = { shop: 1, driver: 1, job: 1, peer: 1, gap: 1, post: 1 };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
}

function setCache(res, value) {
  res.setHeader("Cache-Control", value);
  res.setHeader("CDN-Cache-Control", value);
  res.setHeader("Vercel-CDN-Cache-Control", value);
}

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
    "t",
    "held",
    "status",
    "avc",
    "ride",
    "how",
    "query",
    "shop",
    "driver",
    "customerPeer",
    "holdMin",
    "flag",
    "strict",
    "cid",
    "fromPeer",
    "mesh",
  ];
  keep.forEach(function (k) {
    if (row[k] != null && row[k] !== "") out[k] = row[k];
  });
  ["cover", "profile", "photo", "menuPhotos", "sdp", "ice", "raw", "pack", "want", "served", "drop"].forEach(function (k) {
    delete out[k];
  });
  if (typeof out.menu === "string" && out.menu.length > 4000) out.menu = out.menu.slice(0, 4000);
  let json = JSON.stringify(out);
  if (json.length > 8192) return null;
  return out;
}

function fromRow(row) {
  if (!row || !WRITE_KINDS[row.kind]) return null;
  const body = {
    id: row.id,
    kind: row.kind,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
  if (!isFinite(body.lat) || !isFinite(body.lng)) return null;
  TEXT_KEYS.forEach(function (k) {
    if (row[k] != null && row[k] !== "") body[k] = row[k];
  });
  JSON_KEYS.forEach(function (k) {
    if (row[k] != null && row[k] !== "") body[k] = row[k];
  });
  if (typeof body.raw === "string" && /^data:/i.test(body.raw)) delete body.raw;
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

async function signedUser(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  const m = h.match(/^Bearer\s+(\S+)/i);
  if (!m) return null;
  const creds = await sbAnon.resolve();
  if (!creds.anon || creds.anon.length <= 20) return null;
  try {
    const r = await fetch(creds.sb + "/auth/v1/user", {
      headers: { apikey: creds.anon, Authorization: "Bearer " + m[1] },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (u && (u.id || u.email)) return u;
  } catch (_) {}
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const q = req.query || {};
    const latN = Number(q.lat);
    const lngN = Number(q.lng);
    if (!isFinite(latN) || !isFinite(lngN)) {
      setCache(res, CDN_EMPTY);
      if (req.method === "HEAD") {
        res.status(200).end();
        return;
      }
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
    const lat = Math.round(latN * 100) / 100;
    const lng = Math.round(lngN * 100) / 100;
    const wantLat = lat.toFixed(2);
    const wantLng = lng.toFixed(2);
    if (String(q.lat) !== wantLat || String(q.lng) !== wantLng || q.peer != null) {
      setCache(res, CDN_GET);
      res.setHeader("Location", "/api/space?lat=" + wantLat + "&lng=" + wantLng);
      res.status(302).end();
      return;
    }
    const memKey = wantLat + "," + wantLng;
    if (memGet.body && memGet.key === memKey && Date.now() - memGet.at < 120000) {
      setCache(res, CDN_GET);
      if (req.method === "HEAD") {
        res.status(200).end();
        return;
      }
      res.status(200).json(memGet.body);
      return;
    }
    const creds = await sbAnon.resolve();
    if (!creds.anon || creds.anon.length <= 20) {
      setCache(res, CDN_GET);
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
        peers: [],
      });
      return;
    }
    const qs = new URLSearchParams({
      select: SELECT,
      kind: "in.(shop,driver,job,post,peer,gap)",
      order: "updated_at.desc",
      limit: "60",
    });
    const got = await sb("sn_listings?" + qs.toString());
    if (!got.ok) {
      setCache(res, CDN_GET);
      res.status(200).json({
        ok: false,
        local: true,
        status: got.status,
        shops: [],
        drops: [],
        drivers: [],
        posts: [],
        jobs: [],
        peers: [],
      });
      return;
    }
    const buckets = { shops: [], drops: [], drivers: [], posts: [], jobs: [], peers: [] };
    (got.json || []).forEach(function (row) {
      const body = fromRow(row);
      if (!body) return;
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
      const k =
        body.kind === "shop"
          ? "shops"
          : body.kind === "driver"
            ? "drivers"
            : body.kind === "post" || body.kind === "gap"
              ? "posts"
              : body.kind === "job"
                ? "jobs"
                : body.kind === "peer"
                  ? "peers"
                  : "";
      if (k) buckets[k].push(body);
    });
    const out = Object.assign({ ok: true, local: false }, buckets);
    memGet = { key: memKey, at: Date.now(), body: out };
    setCache(res, CDN_GET);
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).json(out);
    return;
  }

  if (req.method !== "POST") {
    setCache(res, "no-store");
    res.status(405).json({ ok: false, error: "method" });
    return;
  }

  setCache(res, "no-store");
  const who = await signedUser(req);
  if (!who) {
    res.status(401).json({ ok: false, error: "login", need: "login" });
    return;
  }
  const body = readBody(req);
  const row = slim(body.row || body);
  if (!row || !row.id || !WRITE_KINDS[row.kind] || !isFinite(Number(row.lat))) {
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
