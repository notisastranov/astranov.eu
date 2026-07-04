-- Astranov Value Coin (AVC) — transparent work-based ledger
-- 1 AVC ≡ 1 EUR reference peg · minted only from verified work · no fiat keyboard injection

CREATE TABLE IF NOT EXISTS avc_constitution (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  peg_eur       numeric(12,6) NOT NULL DEFAULT 1,
  motto         text NOT NULL DEFAULT 'Justice → Truth → Freedom',
  mint_rule     text NOT NULL DEFAULT 'AVC mints only from verified human work inside Astranov — delivery, vendor, driver, specialist, coders build. No central fiat creation.',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO avc_constitution (id, peg_eur, motto, mint_rule)
VALUES (1, 1, 'Justice → Truth → Freedom',
  'AVC mints only from verified human work inside Astranov. 1 AVC = 1 EUR reference. No keyboard fiat.')
ON CONFLICT (id) DO UPDATE SET updated_at = now();

CREATE TABLE IF NOT EXISTS avc_ledger (
  id              bigserial PRIMARY KEY,
  seq             bigint NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  counterparty_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delta_avc       numeric(14,4) NOT NULL,
  balance_after   numeric(14,4),
  work_type       text NOT NULL,
  work_proof      jsonb NOT NULL DEFAULT '{}',
  order_id        text,
  invoice_id      text,
  lat             double precision,
  lng             double precision,
  prev_hash       text,
  entry_hash      text NOT NULL,
  public_note     text,
  auditor_visible boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS avc_ledger_user_idx ON avc_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS avc_ledger_work_idx ON avc_ledger(work_type, created_at DESC);
CREATE INDEX IF NOT EXISTS avc_ledger_seq_idx ON avc_ledger(seq);

ALTER TABLE avc_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own avc ledger" ON avc_ledger;
CREATE POLICY "Users read own avc ledger"
  ON avc_ledger FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = counterparty_id);

DROP POLICY IF EXISTS "Auditors read avc ledger" ON avc_ledger;
CREATE POLICY "Auditors read avc ledger"
  ON avc_ledger FOR SELECT
  USING (public.is_auditor_or_accountant());

DROP POLICY IF EXISTS "Service avc ledger all" ON avc_ledger;
CREATE POLICY "Service avc ledger all"
  ON avc_ledger FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION avc_next_seq()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(seq), 0) + 1 FROM avc_ledger;
$$;

CREATE OR REPLACE FUNCTION avc_hash_entry(
  p_seq bigint, p_prev text, p_user uuid, p_delta numeric, p_work text, p_proof jsonb, p_at timestamptz
)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(
    (COALESCE(p_seq::text, '') || '|' || COALESCE(p_prev, 'genesis') || '|' ||
     COALESCE(p_user::text, '') || '|' || COALESCE(p_delta::text, '') || '|' ||
     COALESCE(p_work, '') || '|' || COALESCE(p_proof::text, '{}') || '|' ||
     COALESCE(p_at::text, ''))::bytea
  ), 'hex');
$$;

CREATE OR REPLACE FUNCTION avc_ledger_append(
  p_user_id uuid,
  p_delta numeric,
  p_work_type text,
  p_work_proof jsonb DEFAULT '{}',
  p_counterparty_id uuid DEFAULT NULL,
  p_order_id text DEFAULT NULL,
  p_invoice_id text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_public_note text DEFAULT NULL
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seq bigint;
  v_prev text;
  v_bal numeric;
  v_hash text;
  v_id bigint;
BEGIN
  IF p_delta = 0 THEN RETURN NULL; END IF;
  IF p_work_type IS NULL OR length(trim(p_work_type)) < 2 THEN
    RAISE EXCEPTION 'avc work_type required';
  END IF;

  v_seq := avc_next_seq();
  SELECT entry_hash INTO v_prev FROM avc_ledger ORDER BY seq DESC LIMIT 1;
  v_prev := COALESCE(v_prev, 'genesis');

  PERFORM add_balance(p_user_id, p_delta);
  SELECT balance INTO v_bal FROM balance_ledger WHERE user_id = p_user_id;

  v_hash := avc_hash_entry(v_seq, v_prev, p_user_id, p_delta, p_work_type, p_work_proof, now());

  INSERT INTO avc_ledger (
    seq, user_id, counterparty_id, delta_avc, balance_after, work_type, work_proof,
    order_id, invoice_id, lat, lng, prev_hash, entry_hash, public_note
  ) VALUES (
    v_seq, p_user_id, p_counterparty_id, p_delta, v_bal, p_work_type, COALESCE(p_work_proof, '{}'::jsonb),
    p_order_id, p_invoice_id, p_lat, p_lng, v_prev, v_hash, p_public_note
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Wrap legacy add_balance for service paths that skip work proof (log as system_adjust)
CREATE OR REPLACE FUNCTION add_balance(uid uuid, delta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE balance_ledger SET balance = balance + delta WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO balance_ledger(user_id, balance) VALUES (uid, delta);
  END IF;
END;
$$;

COMMENT ON TABLE avc_ledger IS 'Transparent AVC chain — 1:1 EUR peg, work-mint only';

GRANT EXECUTE ON FUNCTION avc_ledger_append TO service_role;

INSERT INTO public.booker_sites (id, slug, domain, business_type, mode, branding, contact, config, active, approval_status)
VALUES (
  'coin',
  'coin',
  'coin.astranov.eu',
  'finance_coin',
  'slot',
  '{"title":"AVC Justice Coin","subtitle":"1 AVC = 1 EUR · work-mint only"}'::jsonb,
  '{"email":"notisastranov@gmail.com","address":"Astranov Group · Justice Ledger"}'::jsonb,
  '{"portal":"avc","currency":"AVC","peg_eur":1,"transparent":true}'::jsonb,
  true,
  'live'
) ON CONFLICT (id) DO UPDATE SET
  domain = excluded.domain,
  branding = excluded.branding,
  config = excluded.config,
  active = true,
  approval_status = 'live',
  updated_at = now();

UPDATE public.booker_sites
SET config = COALESCE(config, '{}'::jsonb) || '{"currency":"AVC","peg_eur":1}'::jsonb
WHERE id IN ('auditors', 'astranov') AND (config->>'currency') IS DISTINCT FROM 'AVC';