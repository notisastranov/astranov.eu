-- Supabase advisor: public.astranov_profiles was a security-definer view,
-- so a caller could read every profile (balance, phone, role) past RLS.
-- security_invoker makes the view run as the querying user.
ALTER VIEW public.astranov_profiles SET (security_invoker = true);
