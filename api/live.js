/** Live SpaceNet feed. No cache. Photos never leave the database. */
const sbAnon = require("../lib/sb-anon");

var SELECT =
  "id,kind,lat,lng,updated_at," +
  "name:body->>name,phone:body->>phone,status:body->>status,peer:body->>peer," +
  "note:body->>note,flag:body->>flag,how:body->>how,query:body->>query," +
  "customerPeer:body->>customerPeer,avc:body->avc,ride:body->ride";

function fromRow(row) {
  if (!row || !row.kind) return null;
  var lat = Number(row.lat), lng = Number(row.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return {
    id: row.id,
    kind: row.kind,
    lat: lat,
    lng: lng,
    name: row.name || "",
    phone: row.phone || "",
    status: row.status || "",
    peer: row.peer || "",
    note: row.note || "",
    flag: row.flag || "",
    how: row.how || "",
    query: row.query || "",
    customerPeer: row.customerPeer || "",
    avc: row.avc,
    ride: row.ride || null,
    t: row.updated_at || ""
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ ok: false });
    return;
  }
  var creds = await sbAnon.resolve();
  if (!creds.anon) {
    res.status(200).json({ ok: false, shops: [], drivers: [], drops: [], jobs: [], peers: [] });
    return;
  }
  var qs = new URLSearchParams({
    select: SELECT,
    kind: "in.(shop,driver,job,drop,peer)",
    order: "updated_at.desc",
    limit: "120"
  });
  var r = await fetch(creds.sb + "/rest/v1/sn_listings?" + qs.toString(), {
    headers: { apikey: creds.anon, Authorization: "Bearer " + creds.anon, Accept: "application/json" }
  });
  var json = [];
  try { json = await r.json(); } catch (e) { json = []; }
  var buckets = { ok: !!r.ok, shops: [], drivers: [], drops: [], jobs: [], peers: [] };
  (Array.isArray(json) ? json : []).forEach(function (row) {
    var body = fromRow(row);
    if (!body) return;
    var k = body.kind === "shop" ? "shops" : body.kind === "driver" ? "drivers" : body.kind === "drop" ? "drops" : body.kind === "job" ? "jobs" : body.kind === "peer" ? "peers" : "";
    if (k) buckets[k].push(body);
  });
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  res.status(200).json(buckets);
};
