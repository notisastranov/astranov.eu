/** Latest SpaceNet stamp. No cache. Reads VERSION (the file every stamp writes): no hardcoded number.
 * Fallback: the X-Astranov-Build header value in vercel.json (also stamped). */
var fs = require("fs");
var path = require("path");
function latest() {
  try {
    var v = fs.readFileSync(path.join(process.cwd(), "VERSION"), "utf8").trim();
    if (/^\d{4,}$/.test(v)) return v;
  } catch (e) {}
  try {
    var cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    var hit = "";
    (cfg.headers || []).forEach(function (h) {
      (h.headers || []).forEach(function (kv) { if (!hit && /^x-astranov-build$/i.test(kv.key || "")) hit = String(kv.value || ""); });
    });
    if (/^\d{4,}$/.test(hit)) return hit;
  } catch (e) {}
  return "";
}
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json({ latest: latest() });
};
