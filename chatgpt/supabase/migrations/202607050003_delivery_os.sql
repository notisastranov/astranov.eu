-- ASTRANOV Delivery OS: honest whole-country commerce network primitives.
-- Coverage is intentionally explicit: ASTRANOV live, partner served, requested, not ready yet.

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN ('city','island','town','village','remote relay')),
  coverage_status text NOT NULL DEFAULT 'not ready yet' CHECK (coverage_status IN ('ASTRANOV live','partner served','requested','not ready yet')),
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_km numeric(8,2) NOT NULL DEFAULT 3,
  parent_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  partner_notes jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS verified_node boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS merchant_readiness text NOT NULL DEFAULT 'requested' CHECK (merchant_readiness IN ('ready','requested','paused','not ready yet'));
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS partner_connector_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'food';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dispatch_status text NOT NULL DEFAULT 'unmatched';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'test_safe' CHECK (payment_mode IN ('test_safe','verified_live'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'test_safe';

CREATE TABLE IF NOT EXISTS public.shop_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Main menu',
  source text NOT NULL DEFAULT 'vendor',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','imported','needs_review')),
  items jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  display_name text,
  vehicle_type text NOT NULL DEFAULT 'bike',
  availability text NOT NULL DEFAULT 'offline' CHECK (availability IN ('online','busy','offline','paused')),
  field_lat double precision,
  field_lng double precision,
  trust_score numeric(4,3) NOT NULL DEFAULT 0.500,
  verified_node boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  score numeric(10,3) NOT NULL DEFAULT 0,
  distance_km numeric(8,2),
  merchant_readiness text NOT NULL DEFAULT 'requested',
  vehicle_fit numeric(5,3) NOT NULL DEFAULT 0,
  trust_score numeric(4,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','offered','accepted','rejected','expired')),
  ranking_factors jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id text REFERENCES public.vendors(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  partner text NOT NULL CHECK (partner IN ('efood','wolt','delivery_hero','doordash','generic_courier','generic_pos')),
  mode text NOT NULL DEFAULT 'official_api_safe',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','requested','approved','active','paused','revoked')),
  config jsonb NOT NULL DEFAULT '{}',
  legal_basis text NOT NULL DEFAULT 'official API, approved partner export/import, merchant consent, or documented webhook only',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_partner_connector_id_fkey;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_partner_connector_id_fkey FOREIGN KEY (partner_connector_id) REFERENCES public.partner_connectors(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id text REFERENCES public.invoices(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('test_authorization','debit','credit','refund','rider_payout','platform_fee','vat_hold')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR_TEST',
  status text NOT NULL DEFAULT 'test_safe' CHECK (status IN ('test_safe','pending','posted','void')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_zones_status_idx ON public.delivery_zones(coverage_status, zone_type);
CREATE INDEX IF NOT EXISTS shop_menus_vendor_idx ON public.shop_menus(vendor_id, status);
CREATE INDEX IF NOT EXISTS delivery_drivers_zone_idx ON public.delivery_drivers(zone_id, availability);
CREATE INDEX IF NOT EXISTS dispatch_matches_order_idx ON public.dispatch_matches(order_id, score DESC);
CREATE INDEX IF NOT EXISTS partner_connectors_partner_idx ON public.partner_connectors(partner, status);
CREATE INDEX IF NOT EXISTS wallet_entries_user_idx ON public.wallet_entries(user_id, created_at DESC);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read delivery zones" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "Authenticated request delivery zones" ON public.delivery_zones FOR INSERT WITH CHECK (auth.uid() = created_by OR auth.role() = 'service_role');
CREATE POLICY "Service all delivery zones" ON public.delivery_zones FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read active shop menus" ON public.shop_menus FOR SELECT USING (status IN ('active','imported'));
CREATE POLICY "Vendor owners manage shop menus" ON public.shop_menus FOR ALL USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = shop_menus.vendor_id AND v.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = shop_menus.vendor_id AND v.owner_id = auth.uid()));
CREATE POLICY "Service all shop menus" ON public.shop_menus FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read online verified drivers" ON public.delivery_drivers FOR SELECT USING (availability IN ('online','busy') AND verified_node = true);
CREATE POLICY "Drivers manage own node" ON public.delivery_drivers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service all delivery drivers" ON public.delivery_drivers FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Order participants read dispatch matches" ON public.dispatch_matches FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = dispatch_matches.order_id AND (o.customer_id = auth.uid() OR o.driver_id = auth.uid())));
CREATE POLICY "Service all dispatch matches" ON public.dispatch_matches FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Vendor owners read connectors" ON public.partner_connectors FOR SELECT USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = partner_connectors.vendor_id AND v.owner_id = auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Vendor owners request connectors" ON public.partner_connectors FOR INSERT WITH CHECK (created_by = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "Service all partner connectors" ON public.partner_connectors FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users read own wallet entries" ON public.wallet_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service all wallet entries" ON public.wallet_entries FOR ALL USING (auth.role() = 'service_role');

INSERT INTO public.delivery_zones (code, name, zone_type, coverage_status, center_lat, center_lng, radius_km, partner_notes)
VALUES
  ('gr-athens-core', 'Athens core', 'city', 'requested', 37.9838, 23.7275, 12, '{"doctrine":"verify shops, drivers, coordinators before live"}'),
  ('gr-rhodes-island', 'Rhodes island', 'island', 'ASTRANOV live', 36.4341, 28.2176, 35, '{"relay":"island node"}'),
  ('gr-kastellorizo-relay', 'Kastellorizo remote relay', 'remote relay', 'not ready yet', 36.1496, 29.5930, 8, '{"needs":"coordinator, verified drivers, partner fallback"}')
ON CONFLICT (code) DO NOTHING;
