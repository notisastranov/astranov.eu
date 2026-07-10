-- Daily support digest — problems + mission progression for system improvement

CREATE TABLE IF NOT EXISTS support_digests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date   date NOT NULL,
  problems      jsonb NOT NULL DEFAULT '[]',
  progression   jsonb NOT NULL DEFAULT '[]',
  server_stats  jsonb NOT NULL DEFAULT '{}',
  client_stats  jsonb NOT NULL DEFAULT '{}',
  summary_text  text,
  notified      boolean NOT NULL DEFAULT false,
  notify_channel text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_digests_date_uidx ON support_digests(digest_date);
CREATE INDEX IF NOT EXISTS support_digests_created_idx ON support_digests(created_at DESC);

ALTER TABLE support_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role support digests all" ON support_digests;
CREATE POLICY "Service role support digests all"
  ON support_digests FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Owner read support digests" ON support_digests;
CREATE POLICY "Owner read support digests"
  ON support_digests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true)
  );

-- Client telemetry buffer (anon insert, service reads)
CREATE TABLE IF NOT EXISTS support_client_reports (
  id          bigserial PRIMARY KEY,
  digest_date date NOT NULL,
  session_id  text,
  build       text,
  problems    jsonb NOT NULL DEFAULT '[]',
  progression jsonb NOT NULL DEFAULT '[]',
  stats       jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_client_reports_date_idx ON support_client_reports(digest_date, created_at DESC);

ALTER TABLE support_client_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon insert support client reports" ON support_client_reports;
CREATE POLICY "Anon insert support client reports"
  ON support_client_reports FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role support client reports all" ON support_client_reports;
CREATE POLICY "Service role support client reports all"
  ON support_client_reports FOR ALL
  USING (auth.role() = 'service_role');