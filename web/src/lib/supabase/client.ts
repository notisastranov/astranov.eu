import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for Astranov.Eu (ref lkoatrkhuigdolnjsbie, eu-west-1).
 * Env vars only — never hardcode keys.
 *
 * Guest boot should stay quiet until sign-in (egress law); callers decide when to connect.
 */

function envNonEmpty(...candidates: Array<string | undefined>): string {
  for (const value of candidates) {
    const trimmed = (value ?? "").trim();
    // Empty string in .env.example must not block the publishable-key alias.
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}

const url = envNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anon = envNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

let browserClient: SupabaseClient | null = null;

export function hasSupabaseEnv(): boolean {
  return Boolean(url && anon && anon.length > 20);
}

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseEnv()) return null;
  if (typeof window === "undefined") {
    return createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  if (!browserClient) {
    browserClient = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

export function supabaseProjectHint() {
  return {
    name: "Astranov.Eu",
    ref: "lkoatrkhuigdolnjsbie",
    region: "eu-west-1",
    urlConfigured: Boolean(url),
    anonConfigured: Boolean(anon && anon.length > 20),
  };
}
