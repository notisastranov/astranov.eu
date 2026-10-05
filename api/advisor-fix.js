/** One-shot Supabase advisor fix. Runs only the statements below. Never returns a connection string. */
const postgres = require("postgres");

function safe(err) {
  return String((err && err.message) || err || "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted")
    .slice(0, 180);
}

const SQL = [
  `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) opt
        WHERE opt LIKE 'security_invoker=%'
      )
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', r.nspname, r.relname);
  END LOOP;
END $$`,
  `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions', r.nspname, r.proname, r.args);
  END LOOP;
END $$`
];

module.exports = async function handler(req, res) {
  if (req.headers["x-astranov-advisor"] !== "1") {
    res.status(404).json({ ok: false });
    return;
  }
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
  if (!url) {
    res.status(200).json({
      ok: false,
      reason: "no-database-url",
      hasDb: !!process.env.SUPABASE_DB_URL,
      hasDatabase: !!process.env.DATABASE_URL,
      hasPostgres: !!process.env.POSTGRES_URL
    });
    return;
  }
  const sql = postgres(url, { prepare: false, max: 1, ssl: "require", connect_timeout: 20 });
  try {
    for (const statement of SQL) await sql.unsafe(statement);
    const views = await sql`
      SELECT c.relname AS name, c.reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
      ORDER BY c.relname`;
    res.status(200).json({ ok: true, views: views });
  } catch (err) {
    res.status(500).json({ ok: false, error: safe(err) });
  } finally {
    try { await sql.end({ timeout: 5 }); } catch (e) {}
  }
};
