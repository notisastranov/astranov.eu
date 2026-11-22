/** SpaceNet transactions — list/upsert with ≥6y retention (Supabase sn_transactions). */
const sbAnon = require("../sb-anon");

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (typeof req.body === "string") {
      try { resolve(JSON.parse(req.body) || {}); } catch (e) { resolve({}); }
      return;
    }
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }
    var raw = "";
    req.on("data", function (c) { raw += c; if (raw.length > 2e6) raw = raw.slice(0, 2e6); });
    req.on("end", function () {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}

function bearer(req) {
  var h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  var m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function authUser(creds, token) {
  if (!token || !creds.anon) return null;
  try {
    var r = await fetch(creds.sb + "/auth/v1/user", {
      headers: { apikey: creds.anon, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    var j = await r.json();
    return j && j.id ? j : null;
  } catch (e) {
    return null;
  }
}

function sixYearsFrom(iso) {
  var d = iso ? new Date(iso) : new Date();
  if (!isFinite(d.getTime())) d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 6);
  return d.toISOString();
}

async function history(req, res, creds, token, params) {
  if (!token) { json(res, 401, { ok: false, error: "auth required" }); return; }
  const from = params.get("from");
  const to = params.get("to");
  if ([from, to].some(day => day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)))) ||
      (from && to && from > to)) {
    json(res, 400, { ok: false, error: "invalid dates" });
    return;
  }
  try {
    const response = await fetch(creds.sb + "/rest/v1/rpc/sn_transaction_history", {
      method: "POST",
      headers: { apikey: creds.anon, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        scope_all: params.get("scope") === "all",
        date_from: from || null,
        date_to: to || null,
        filter_kind: (params.get("kind") || "").slice(0, 120) || null,
        page_size: Math.min(250, Math.max(1, parseInt(params.get("limit"), 10) || 50)),
        page_offset: Math.max(0, Math.min(2147483647, parseInt(params.get("offset"), 10) || 0)),
        descending: params.get("sort") !== "oldest"
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const forbidden = response.status === 401 || response.status === 403;
      json(res, forbidden ? response.status : 503, { ok: false, error: forbidden ? "access denied" : "history unavailable" });
      return;
    }
    json(res, 200, Object.assign({ ok: true, retention_years: 6 }, await response.json()));
  } catch {
    json(res, 503, { ok: false, error: "history unavailable" });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  var creds = await sbAnon.resolve();
  var sb = String((creds && creds.sb) || "").replace(/\/$/, "");
  var anon = String((creds && creds.anon) || "");
  var svc = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY || "";
  if (!sb || (!anon && !svc)) {
    json(res, 200, { ok: false, error: "supabase unavailable", items: [] });
    return;
  }

  var token = bearer(req);
  var params = new URL(req.url, "https://spacenet.astranov.eu").searchParams;
  if (req.method === "GET" && params.get("history") === "1") {
    if (!anon) { json(res, 503, { ok: false, error: "history unavailable" }); return; }
    return history(req, res, { sb: sb, anon: anon }, token, params);
  }
  var user = await authUser({ sb: sb, anon: anon || svc }, token);
  if (!user) {
    json(res, 401, { ok: false, error: "auth required", items: [] });
    return;
  }

  var key = svc || anon;
  var authHeader = "Bearer " + (svc || token);

  if (req.method === "GET") {
    try {
      var url = sb + "/rest/v1/sn_transactions?user_id=eq." + encodeURIComponent(user.id)
        + "&select=id,client_id,kind,status,summary,amount_avc,payload,exchange,created_at,completed_at,retain_until"
        + "&order=created_at.desc&limit=200";
      var r = await fetch(url, {
        headers: {
          apikey: key,
          Authorization: authHeader,
          Accept: "application/json"
        }
      });
      var rows = await r.json().catch(function () { return []; });
      if (!r.ok) {
        json(res, 200, { ok: false, error: (rows && rows.message) || "list failed", items: [] });
        return;
      }
      json(res, 200, { ok: true, items: Array.isArray(rows) ? rows : [], retention_years: 6 });
    } catch (e) {
      json(res, 200, { ok: false, error: "list dark", items: [] });
    }
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "method" });
    return;
  }

  var body = await readBody(req);
  var nowIso = new Date().toISOString();
  var createdAt = body.created_at && Number.isFinite(Date.parse(body.created_at))
    ? new Date(body.created_at).toISOString() : nowIso;
  var row = {
    user_id: user.id,
    client_id: body.client_id ? String(body.client_id).slice(0, 120) : null,
    kind: String(body.kind || "delivery").slice(0, 64),
    status: String(body.status || "completed").slice(0, 64),
    summary: String(body.summary || "").slice(0, 500),
    amount_avc: Number(body.amount_avc) || 0,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    exchange: Array.isArray(body.exchange) ? body.exchange.slice(0, 40) : [],
    created_at: createdAt,
    completed_at: body.completed_at || nowIso,
    retain_until: sixYearsFrom(createdAt)
  };

  try {
    var headers = {
      apikey: key,
      Authorization: authHeader,
      "Content-Type": "application/json",
      Prefer: row.client_id ? "resolution=merge-duplicates,return=representation" : "return=representation"
    };
    var endpoint = sb + "/rest/v1/sn_transactions";
    if (row.client_id) endpoint += "?on_conflict=user_id,client_id";
    var r2 = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(row)
    });
    var out = await r2.json().catch(function () { return null; });
    if (!r2.ok) {
      json(res, 200, { ok: false, error: (out && (out.message || out.error)) || "upsert failed", item: null });
      return;
    }
    var item = Array.isArray(out) ? out[0] : out;
    json(res, 200, { ok: true, item: item, retention_years: 6 });
  } catch (e) {
    json(res, 200, { ok: false, error: "upsert dark", item: null });
  }
};
