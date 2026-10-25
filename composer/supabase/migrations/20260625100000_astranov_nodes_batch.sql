-- Astranov decentralized nodes + work-together batches

CREATE TABLE IF NOT EXISTS astranov_batches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id   text UNIQUE DEFAULT 'BAT-' || upper(substring(gen_random_uuid()::text from 1 for 6)),
  owner_id   uuid REFERENCES auth.users(id),
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS astranov_nodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id      text UNIQUE NOT NULL,
  user_id      uuid REFERENCES auth.users(id),
  batch_id     uuid REFERENCES astranov_batches(id) ON DELETE SET NULL,
  platform     text DEFAULT 'web',
  install_mode text DEFAULT 'browser',
  roles        jsonb NOT NULL DEFAULT '["relay","comms","field"]'::jsonb,
  lat          double precision,
  lng          double precision,
  props        jsonb DEFAULT '{}',
  last_seen    timestamptz DEFAULT now(),
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS astranov_nodes_batch_idx ON astranov_nodes(batch_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS astranov_nodes_user_idx ON astranov_nodes(user_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS astranov_batches_owner_idx ON astranov_batches(owner_id, created_at DESC);

ALTER TABLE astranov_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE astranov_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read batches" ON astranov_batches;
CREATE POLICY "Auth read batches" ON astranov_batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner insert batches" ON astranov_batches;
CREATE POLICY "Owner insert batches" ON astranov_batches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Auth read nodes" ON astranov_nodes;
CREATE POLICY "Auth read nodes" ON astranov_nodes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "User upsert own node" ON astranov_nodes;
CREATE POLICY "User upsert own node" ON astranov_nodes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User update own node" ON astranov_nodes;
CREATE POLICY "User update own node" ON astranov_nodes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service all batches" ON astranov_batches;
CREATE POLICY "Service all batches" ON astranov_batches FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service all nodes" ON astranov_nodes;
CREATE POLICY "Service all nodes" ON astranov_nodes FOR ALL USING (auth.role() = 'service_role');