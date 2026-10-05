import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "npm:postgres";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};

const NEED = [
  "VERCEL_TOKEN",
  "XAI_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER",
  "CODERS_BRIDGE_SECRET",
];

async function ping(url: string, init?: RequestInit) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    return { ok: r.ok, st: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, st: 0, ms: Date.now() - t0, err: String(e).slice(0, 80) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("x-astranov-advisor") === "1") {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "";
    if (!dbUrl) {
      return new Response(JSON.stringify({ ok: false, reason: "no-database-url", rev: "4329" }), { headers: cors });
    }
    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    try {
      await sql.unsafe(`DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) opt
        WHERE opt LIKE 'security_invoker=%'
      )
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', r.nspname, r.relname);
  END LOOP;
END $$`);
      await sql.unsafe(`DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions', r.nspname, r.proname, r.args);
  END LOOP;
END $$`);
      const views = await sql`select c.relname as name, c.reloptions from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'`;
      return new Response(JSON.stringify({ ok: true, rev: "4329", views }), { headers: cors });
    } catch (e) {
      const msg = String(e && (e as Error).message || e).replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted").slice(0, 180);
      return new Response(JSON.stringify({ ok: false, rev: "4329", error: msg }), { headers: cors, status: 500 });
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
  const env = Deno.env.toObject();
  const secrets: Record<string, boolean> = {};
  for (const n of NEED) secrets[n] = !!(env[n] && env[n].length > 4);
  const present = Object.keys(env)
    .filter((k) => !k.startsWith("DENO_") && !k.startsWith("SB_"))
    .sort();

  let vercel: Record<string, unknown> = { has: secrets.VERCEL_TOKEN };
  const tok = env.VERCEL_TOKEN || "";
  if (tok) {
    try {
      const u = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: "Bearer " + tok },
      });
      const j = await u.json();
      const user = (j.user || {}).username || (j.user || {}).id || "";
      const t = await fetch("https://api.vercel.com/v2/teams", {
        headers: { Authorization: "Bearer " + tok },
      });
      const tj = await t.json();
      const teams = ((tj.teams || []) as { slug: string }[]).map((x) => x.slug);
      const p = await fetch("https://api.vercel.com/v9/projects?limit=20", {
        headers: { Authorization: "Bearer " + tok },
      });
      const pj = await p.json();
      const names = ((pj.projects || []) as { name: string }[]).map((x) => x.name);
      vercel = {
        has: true,
        st: u.status,
        user,
        teams,
        projects: names.length,
        names: names.slice(0, 12),
      };
    } catch (e) {
      vercel = { has: true, err: String(e).slice(0, 80) };
    }
  }

  const live = await ping("https://astranov.eu/", { cache: "no-store" });
  const ai = await ping("https://astranov.eu/api/ai", { cache: "no-store" });
  const grok = secrets.XAI_API_KEY
    ? await ping("https://api.x.ai/v1/models", {
        headers: { Authorization: "Bearer " + env.XAI_API_KEY },
      })
    : { ok: false, st: 0, ms: 0 };

  const missing = NEED.filter((n) => !secrets[n]);
  const ok = missing.length === 0 && !!vercel && (vercel as { st?: number }).st === 200;
  return new Response(
    JSON.stringify({
      ok,
      missing,
      secrets,
      present,
      vercel,
      live,
      ai,
      grok,
      rev: "4329",
      t: Date.now(),
    }),
    { headers: cors, status: 200 }
  );
});
