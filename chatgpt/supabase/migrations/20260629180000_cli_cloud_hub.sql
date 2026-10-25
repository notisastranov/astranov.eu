-- Cloud CLI transcripts · search · private map DM circles

CREATE TABLE IF NOT EXISTS cli_transcripts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line text NOT NULL,
  cls text NOT NULL DEFAULT 'out',
  circle_id text,
  peer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cli_transcripts_user_idx ON cli_transcripts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cli_transcripts_peer_idx ON cli_transcripts(peer_id, created_at DESC) WHERE peer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cli_transcripts_circle_idx ON cli_transcripts(circle_id, created_at DESC) WHERE circle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cli_transcripts_created_idx ON cli_transcripts(created_at DESC);

ALTER TABLE cli_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cli_transcripts_insert_own ON cli_transcripts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY cli_transcripts_read_own ON cli_transcripts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = peer_id);

CREATE POLICY cli_transcripts_read_owner ON cli_transcripts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_owner = true));

GRANT SELECT, INSERT ON cli_transcripts TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'circle_messages') THEN
    ALTER TABLE circle_messages ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE cli_transcripts;