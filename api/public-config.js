/** Public host config. Values from host env or Supabase edge. Never from git. */
const sbAnon = require("../lib/sb-anon");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.setHeader("CDN-Cache-Control", "public, max-age=300, s-maxage=300");
  res.setHeader("Vercel-CDN-Cache-Control", "public, max-age=300, s-maxage=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  var creds = await sbAnon.resolve();
  var anon = String((creds && creds.anon) || "").trim();
  var sb = String((creds && creds.sb) || "https://lkoatrkhuigdolnjsbie.supabase.co").replace(/\/$/, "");
  var configured = !!anon && anon.length > 20;
  res.status(200).json({
    sb: sb,
    anon: configured ? anon : "",
    configured: configured,
  });
};
