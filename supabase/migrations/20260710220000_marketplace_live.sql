-- Marketplace live — seed vendors, order geo fields, driver/vendor policies

ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_lat double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_lng double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pay_on_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_accepted_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel text;

CREATE INDEX IF NOT EXISTS orders_driver_status_idx ON orders(driver_id, status, created_at DESC);

-- Seed real demo vendors (Rhodes / Kos) so order-intake never hits vendor_not_found
INSERT INTO vendors (id, name, emoji, lat, lng, category, items, is_active, delivery_enabled, delivery_radius_km, min_order_avc)
VALUES
  ('demo-pitogyra', 'Πιτογύρα Rhodes', '🥙', 36.4412, 28.2225, 'food',
   '[{"name":"Πιτογύρα χοιρινό","price":3.5},{"name":"Μπύρα Alpha","price":2.5},{"name":"Τσιγάρα Marlboro","price":5.5},{"name":"Burger classic","price":6}]'::jsonb,
   true, true, 8, 3),
  ('demo-kafeneio', 'Kafeneio Astranov', '☕', 36.4358, 28.2188, 'cafe',
   '[{"name":"Φραπέ","price":2.2},{"name":"Μπύρα Fix","price":2.8},{"name":"Νερό 500ml","price":0.5}]'::jsonb,
   true, true, 6, 2),
  ('demo-minimarket', 'Mini Market Kos', '🏪', 36.8932, 27.288, 'grocery',
   '[{"name":"Μπύρα Heineken","price":2.9},{"name":"Τσιγάρα Winston","price":5.2},{"name":"Burger frozen","price":4.5},{"name":"Νερό","price":0.6}]'::jsonb,
   true, true, 10, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  category = EXCLUDED.category,
  items = EXCLUDED.items,
  is_active = true,
  delivery_enabled = true,
  updated_at = now();

DROP POLICY IF EXISTS "Vendor see own orders" ON orders;
CREATE POLICY "Vendor see own orders" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = orders.vendor_id AND v.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Driver update assigned orders" ON orders;
CREATE POLICY "Driver update assigned orders" ON orders FOR UPDATE USING (
  auth.uid() = driver_id OR driver_id IS NULL
);