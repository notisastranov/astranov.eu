/** Public host config. Values from host env or Supabase edge. Never from git. */
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  var sb =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://lkoatrkhuigdolnjsbie.supabase.co";

  var anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SB_ANON ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  anon = String(anon || "").trim();

  if (!anon) {
    try {
      var edge = await fetch(String(sb).replace(/\/$/, "") + "/functions/v1/public-config", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (edge && edge.ok) {
        var j = await edge.json();
        if (j && j.anon) anon = String(j.anon).trim();
        if (j && j.sb) sb = String(j.sb).trim() || sb;
      }
    } catch (e) {
      /* keep empty anon — client sees configured:false */
    }
  }

  var configured = !!anon && anon.length > 20;
  res.status(200).json({
    sb: sb,
    anon: configured ? anon : "",
    configured: configured
  });
};
