-- Auditor / accountant portal — read financial data (auditors.astranov.eu)

CREATE OR REPLACE FUNCTION public.is_auditor_or_accountant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        public.is_astranov_admin()
        OR p.roles ? 'auditor'
        OR p.roles ? 'accountant'
        OR p.roles ? 'admin'
        OR p.id IN (SELECT id FROM auth.users WHERE lower(email) = 'notisastranov@gmail.com')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_auditor_or_accountant() TO authenticated;

DROP POLICY IF EXISTS "Auditors read all invoices" ON public.invoices;
CREATE POLICY "Auditors read all invoices" ON public.invoices
  FOR SELECT USING (public.is_auditor_or_accountant());

DROP POLICY IF EXISTS "Auditors read all orders" ON public.orders;
CREATE POLICY "Auditors read all orders" ON public.orders
  FOR SELECT USING (public.is_auditor_or_accountant());

DROP POLICY IF EXISTS "Auditors read vendors" ON public.vendors;
CREATE POLICY "Auditors read vendors" ON public.vendors
  FOR SELECT USING (public.is_auditor_or_accountant());

DROP POLICY IF EXISTS "Auditors read payout events" ON public.field_events;
CREATE POLICY "Auditors read payout events" ON public.field_events
  FOR SELECT USING (
    public.is_auditor_or_accountant()
    AND action IN ('payout', 'order', 'pay')
  );

INSERT INTO public.booker_sites (id, slug, domain, business_type, mode, branding, contact, config, active, approval_status)
VALUES (
  'auditors',
  'auditors',
  'auditors.astranov.eu',
  'finance_audit',
  'slot',
  '{"title":"Astranov Auditors","subtitle":"Invoices · payments · platform performance"}'::jsonb,
  '{"email":"notisastranov@gmail.com","address":"Astranov Group · Finance"}'::jsonb,
  '{"portal":"auditor","currency":"EUR"}'::jsonb,
  true,
  'live'
) ON CONFLICT (id) DO UPDATE SET
  domain = excluded.domain,
  business_type = excluded.business_type,
  branding = excluded.branding,
  active = true,
  approval_status = 'live',
  updated_at = now();