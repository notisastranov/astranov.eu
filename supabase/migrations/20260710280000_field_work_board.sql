-- Field work board — availability, offers, requests · full pricing · open verticals

CREATE TABLE IF NOT EXISTS field_work_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type       text NOT NULL CHECK (post_type IN ('availability', 'offer', 'request')),
  vertical        text NOT NULL DEFAULT 'work'
    CHECK (vertical IN ('work', 'delivery', 'dating', 'real_estate', 'services', 'custom')),
  specialty       text NOT NULL,
  description     text,
  price_avc       numeric(12,2),
  price_eur       numeric(12,2),
  price_unit      text NOT NULL DEFAULT 'job',
  pricing_detail  jsonb NOT NULL DEFAULT '{}',
  lat             double precision,
  lng             double precision,
  radius_km       numeric(8,2) NOT NULL DEFAULT 25,
  target_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_work_posts_open_idx
  ON field_work_posts(status, vertical, created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS field_work_posts_user_idx ON field_work_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS field_work_posts_geo_idx ON field_work_posts(lat, lng) WHERE lat IS NOT NULL;

ALTER TABLE field_work_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work posts public read open" ON field_work_posts;
CREATE POLICY "work posts public read open" ON field_work_posts
  FOR SELECT USING (status = 'open' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "work posts insert own" ON field_work_posts;
CREATE POLICY "work posts insert own" ON field_work_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work posts update own" ON field_work_posts;
CREATE POLICY "work posts update own" ON field_work_posts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "work posts service all" ON field_work_posts;
CREATE POLICY "work posts service all" ON field_work_posts
  FOR ALL USING (auth.role() = 'service_role');