-- Supabase advisor: public views were security definer, so a caller
-- could read past RLS. security_invoker runs the view as the querying user.
-- Also pin search_path on public functions the advisor flags.

ALTER VIEW public.astranov_profiles SET (security_invoker = true);

DO $$
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
END $$;

DO $$
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
END $$;
