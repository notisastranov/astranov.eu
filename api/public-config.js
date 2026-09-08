/** Public host config. Values from host env (Supabase → Vercel). Never from git. */
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    sb: process.env.SUPABASE_URL || "https://lkoatrkhuigdolnjsbie.supabase.co",
    anon: process.env.SUPABASE_ANON_KEY || process.env.SB_ANON || ""
  });
};
