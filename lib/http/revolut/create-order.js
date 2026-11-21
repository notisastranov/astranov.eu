/** Lean Revolut top-up stub — returns configure hint until secrets exist. */
function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "POST only" })); return; }
  var key = process.env.REVOLUT_API_KEY || process.env.ASTRANOV_REVOLUT_SECRET;
  if (!key) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "revolut not configured", message: "Set REVOLUT_API_KEY" }));
    return;
  }
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "revolut checkout not wired", message: "Secret present; lean stub only — use PayPal for now." }));
};
