-- Live database fix. The view runs as the caller. Phone and balances
-- are not granted to anon or authenticated. Wallet writes are service_role only.

DROP POLICY IF EXISTS "Auditor read profiles" ON public.profiles;
CREATE POLICY "Auditor read profiles" ON public.profiles
  FOR SELECT
  TO public
  USING (
    id = (SELECT auth.uid())
    OR public.is_owner()
    OR public.is_auditor_or_accountant()
  );

DROP POLICY IF EXISTS profiles_read_all ON public.profiles;

DROP VIEW IF EXISTS public.astranov_profiles;
CREATE VIEW public.astranov_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  display_name,
  avatar_emoji,
  bio,
  is_owner,
  is_vendor,
  roles,
  public_email,
  site_slug,
  created_at,
  updated_at,
  CASE
    WHEN roles ? 'admin' OR is_owner THEN 'admin'
    WHEN roles ? 'vendor' OR is_vendor THEN 'vendor'
    WHEN roles ? 'driver' THEN 'driver'
    WHEN roles ? 'auditor' THEN 'auditor'
    ELSE 'client'
  END AS role
FROM public.profiles p;

GRANT SELECT ON public.astranov_profiles TO anon, authenticated, service_role;

REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, display_name, avatar_url, is_owner,
  country_code, city, created_at, updated_at,
  availability_status, map_visibility, show_on_map, preferred_map_layer,
  bio, avatar_emoji, is_vendor, is_bot, is_agent, last_seen_at,
  roles, field_lat, field_lng, field_seen_at, map_hidden, map_mode,
  profile_page, public_email, site_slug, site_request_status, is_auditor
) ON public.profiles TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.add_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_avc(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_eur(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.avc_ledger_append(uuid, numeric, text, jsonb, uuid, text, text, double precision, double precision, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_avc(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_eur(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.avc_ledger_append(uuid, numeric, text, jsonb, uuid, text, text, double precision, double precision, text) TO service_role;
