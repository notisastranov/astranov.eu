-- Unified globe session per user (sync across devices)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS globe_session jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS profiles_globe_session_idx ON profiles ((globe_session IS NOT NULL)) WHERE globe_session != '{}'::jsonb;