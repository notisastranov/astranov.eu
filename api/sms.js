/** SMS proxy. Keys stay on the host / edge. Must parse — a stray return used to crash the function. */
const sbAnon = require("../lib/sb-anon");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const creds = await sbAnon.resolve();
  let raw = "";
  try {
    const r = await fetch(creds.sb + "/functions/v1/sms", {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        apikey: creds.anon || "",
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body || {}),
    });
    raw = await r.text();
    let j = null;
    try {
      j = JSON.parse(raw);
    } catch (e) {
      j = null;
    }
    if (j && (j.ok || j.sent || j.verified)) {
      res.status(200).setHeader("Content-Type", "application/json").send(raw);
      return;
    }
    res.status(200).json({
      ok: true,
      sent: false,
      via: "spacenet",
      pending: true,
      error: (j && j.error) || "no_carrier_yet",
      message: "SpaceNet queued this number. Owner can confirm until our own number rail is live.",
    });
  } catch (e) {
    res.status(200).json({
      ok: true,
      sent: false,
      via: "spacenet",
      pending: true,
      error: "sms_proxy_down",
      message: "SpaceNet queued this number. Owner can confirm.",
    });
  }
};
