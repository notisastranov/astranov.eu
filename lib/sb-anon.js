/** Resolve public Supabase anon the same way /api/public-config does.
 *  Never commit a key. Cache in the isolate so we do not hit edge every request.
 */
var SB_DEFAULT = "https://lkoatrkhuigdolnjsbie.supabase.co";
var cached = { anon: "", sb: SB_DEFAULT, at: 0 };

function envSb() {
  return String(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      SB_DEFAULT
  )
    .trim()
    .replace(/\/$/, "");
}

function envAnon() {
  return String(
    process.env.SUPABASE_ANON_KEY ||
      process.env.SB_ANON ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ""
  ).trim();
}

async function resolve() {
  if (cached.anon && cached.anon.length > 20 && Date.now() - cached.at < 10 * 60 * 1000) {
    return cached;
  }
  var anon = envAnon();
  var sb = envSb() || SB_DEFAULT;
  if (!anon || anon.length <= 20) {
    try {
      var edge = await fetch(sb + "/functions/v1/public-config", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (edge && edge.ok) {
        var j = await edge.json();
        if (j && j.anon) anon = String(j.anon).trim();
        if (j && j.sb) sb = String(j.sb).trim().replace(/\/$/, "") || sb;
      }
    } catch (_) {}
  }
  cached = { anon: anon || "", sb: sb || SB_DEFAULT, at: Date.now() };
  return cached;
}

module.exports = { resolve, envSb, envAnon };
