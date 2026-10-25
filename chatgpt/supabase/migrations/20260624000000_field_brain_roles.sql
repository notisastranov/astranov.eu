-- Field development brain: multi-role users (client + driver + vendor), compliant usage telemetry

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '["client","driver"]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_lat double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_lng double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS field_seen_at timestamptz;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders(driver_id, status);

CREATE TABLE IF NOT EXISTS field_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'client',
  action       text NOT NULL,
  detail       text,
  lat          double precision,
  lng          double precision,
  props        jsonb NOT NULL DEFAULT '{}',
  brain_synced boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_events_user_idx ON field_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS field_events_action_idx ON field_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS field_events_brain_idx ON field_events(brain_synced, created_at DESC) WHERE brain_synced = false;

ALTER TABLE field_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own field events" ON field_events;
CREATE POLICY "Users insert own field events" ON field_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own field events" ON field_events;
CREATE POLICY "Users read own field events" ON field_events FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner read field events" ON field_events;
CREATE POLICY "Owner read field events" ON field_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true)
);

DROP POLICY IF EXISTS "Service all field events" ON field_events;
CREATE POLICY "Service all field events" ON field_events FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Driver see assigned orders" ON orders;
CREATE POLICY "Driver see assigned orders" ON orders FOR SELECT USING (
  auth.uid() = driver_id OR auth.uid() = customer_id
);

DROP POLICY IF EXISTS "Driver claim open orders" ON orders;
CREATE POLICY "Driver claim open orders" ON orders FOR UPDATE USING (
  auth.uid() = driver_id OR (driver_id IS NULL AND status IN ('pending', 'seeking_driver'))
);