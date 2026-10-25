-- ONE DATABASE — all Astranov tenants on lkoatrkhuigdolnjsbie (profiles is canonical)

COMMENT ON SCHEMA public IS 'Astranov one database — globe · coin · auditors · yachts · booker · AVC';

-- Compatibility view (yachting RLS / adapters that referenced astranov_profiles)
CREATE OR REPLACE VIEW public.astranov_profiles AS
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_emoji,
    p.bio,
    p.is_owner,
    p.is_vendor,
    p.balance,
    p.roles,
    p.phone,
    p.public_email,
    p.site_slug,
    p.created_at,
    p.updated_at,
    CASE
      WHEN p.roles ? 'admin' OR p.is_owner THEN 'admin'
      WHEN p.roles ? 'vendor' OR p.is_vendor THEN 'vendor'
      WHEN p.roles ? 'driver' THEN 'driver'
      WHEN p.roles ? 'auditor' THEN 'auditor'
      ELSE 'client'
    END AS role
  FROM public.profiles p;

GRANT SELECT ON public.astranov_profiles TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.astranov_has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.roles ?| allowed_roles
        OR (p.is_owner AND 'admin' = ANY(allowed_roles))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.astranov_has_role(text[]) TO authenticated;

-- All platform tenants on one booker registry
INSERT INTO public.booker_sites (id, slug, domain, business_type, mode, branding, contact, config, active, approval_status)
VALUES
  ('astranov', 'astranov', 'astranov.eu', 'globe_platform', 'slot',
   '{"title":"Astranov Globe","subtitle":"Earth · delivery · social · AVC"}'::jsonb,
   '{"email":"notisastranov@gmail.com"}'::jsonb,
   '{"portal":"globe","database":"central","currency":"AVC","peg_eur":1}'::jsonb,
   true, 'live')
ON CONFLICT (id) DO UPDATE SET
  domain = excluded.domain,
  config = booker_sites.config || excluded.config,
  active = true,
  approval_status = 'live',
  updated_at = now();

UPDATE public.booker_sites
SET config = COALESCE(config, '{}'::jsonb) || '{"database":"central","one_database":true}'::jsonb
WHERE id IN ('coin', 'auditors', 'yachts', 'astranov', 'frogschool');