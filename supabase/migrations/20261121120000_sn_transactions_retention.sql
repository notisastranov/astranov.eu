-- SpaceNet user transactions — legal retention ≥ 5 years.
-- Purge is blocked until retain_until; retain_until = created_at + 5 years.

CREATE TABLE IF NOT EXISTS public.sn_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_id       text,
  kind            text NOT NULL DEFAULT 'delivery',
  status          text NOT NULL DEFAULT 'completed',
  summary         text NOT NULL DEFAULT '',
  amount_avc      numeric(14,4) NOT NULL DEFAULT 0,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  exchange        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz NOT NULL DEFAULT now(),
  retain_until    timestamptz NOT NULL DEFAULT (now() + interval '5 years'),
  CONSTRAINT sn_transactions_retain_ge_5y
    CHECK (retain_until >= created_at + interval '5 years')
);

CREATE UNIQUE INDEX IF NOT EXISTS sn_transactions_user_client_uidx
  ON public.sn_transactions (user_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sn_transactions_user_created_idx
  ON public.sn_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sn_transactions_retain_until_idx
  ON public.sn_transactions (retain_until);

ALTER TABLE public.sn_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sn_tx_select_own" ON public.sn_transactions;
CREATE POLICY "sn_tx_select_own" ON public.sn_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sn_tx_insert_own" ON public.sn_transactions;
CREATE POLICY "sn_tx_insert_own" ON public.sn_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sn_tx_update_own" ON public.sn_transactions;
CREATE POLICY "sn_tx_update_own" ON public.sn_transactions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sn_tx_service_all" ON public.sn_transactions;
CREATE POLICY "sn_tx_service_all" ON public.sn_transactions
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Never shorten retention below 5 years from created_at.
CREATE OR REPLACE FUNCTION public.sn_transactions_guard_retain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.retain_until IS NULL OR NEW.retain_until < NEW.created_at + interval '5 years' THEN
    NEW.retain_until := NEW.created_at + interval '5 years';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.retain_until IS NOT NULL AND NEW.retain_until < OLD.retain_until THEN
    NEW.retain_until := OLD.retain_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sn_transactions_guard_retain_trg ON public.sn_transactions;
CREATE TRIGGER sn_transactions_guard_retain_trg
  BEFORE INSERT OR UPDATE ON public.sn_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sn_transactions_guard_retain();

-- Purge only rows past retain_until. Refuses anything still inside the 5y window.
CREATE OR REPLACE FUNCTION public.sn_transactions_purge_expired(p_limit int DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'sn_transactions_purge_expired: service_role only';
  END IF;
  WITH doomed AS (
    SELECT id FROM public.sn_transactions
    WHERE retain_until < now()
      AND retain_until >= created_at + interval '5 years'
    ORDER BY retain_until ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.sn_transactions t
  USING doomed d
  WHERE t.id = d.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.sn_transactions_purge_expired(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sn_transactions_purge_expired(int) TO service_role;

COMMENT ON TABLE public.sn_transactions IS
  'SpaceNet completed exchanges. Legal retention ≥5 years via retain_until; purge only after retain_until.';
COMMENT ON COLUMN public.sn_transactions.retain_until IS
  'Earliest lawful purge instant (= created_at + 5 years minimum).';
COMMENT ON FUNCTION public.sn_transactions_purge_expired(int) IS
  'Deletes only rows with retain_until < now(); service_role only.';
