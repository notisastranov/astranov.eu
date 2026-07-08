-- Astranov · auditors.astranov.eu — general ledger, balance sheets, AVC chain

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_auditor boolean NOT NULL DEFAULT false;

-- Chart of accounts (Ελληνικό απλοποιημένο)
CREATE TABLE IF NOT EXISTS gl_accounts (
  code        text PRIMARY KEY,
  name_el     text NOT NULL,
  name_en     text,
  category    text NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_code text REFERENCES gl_accounts(code),
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

INSERT INTO gl_accounts (code, name_el, name_en, category, sort_order) VALUES
  ('10', 'Ταμείο / AVC', 'Cash & AVC float', 'asset', 10),
  ('30', 'Απαιτήσεις πελατών', 'Accounts receivable', 'asset', 30),
  ('38', 'Προκαταβολές χρηστών (AVC)', 'User AVC liabilities', 'liability', 38),
  ('40', 'Υποχρεώσεις προς προμηθευτές', 'Vendor payables', 'liability', 40),
  ('54', 'ΦΠΑ πληρωτέο', 'VAT payable', 'liability', 54),
  ('60', 'Κεφάλαιο', 'Equity', 'equity', 60),
  ('70', 'Έσοδα πωλήσεων', 'Sales revenue', 'revenue', 70),
  ('71', 'Προμήθειες πλατφόρμας 3%', 'Platform fees', 'revenue', 71),
  ('72', 'Έσοδα διανομής', 'Delivery revenue', 'revenue', 72),
  ('64', 'Έξοδα οδηγών', 'Driver payouts', 'expense', 64),
  ('65', 'Λοιπά έξοδα', 'Other expenses', 'expense', 65)
ON CONFLICT (code) DO NOTHING;

-- Journal (auto + manual entries)
CREATE TABLE IF NOT EXISTS gl_journal_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date    date NOT NULL DEFAULT CURRENT_DATE,
  account_code  text NOT NULL REFERENCES gl_accounts(code),
  debit         numeric(14,2) NOT NULL DEFAULT 0,
  credit        numeric(14,2) NOT NULL DEFAULT 0,
  memo          text,
  source_type   text,
  source_id     text,
  period_month  text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gl_journal_date_idx ON gl_journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS gl_journal_account_idx ON gl_journal_entries(account_code);
CREATE INDEX IF NOT EXISTS gl_journal_period_idx ON gl_journal_entries(period_month);
CREATE INDEX IF NOT EXISTS gl_journal_source_idx ON gl_journal_entries(source_type, source_id);

-- Historical balance sheet snapshots
CREATE TABLE IF NOT EXISTS gl_balance_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_end    date NOT NULL,
  snapshot_type text NOT NULL DEFAULT 'annual' CHECK (snapshot_type IN ('monthly', 'quarterly', 'annual', 'closing')),
  label         text,
  assets        numeric(14,2) NOT NULL DEFAULT 0,
  liabilities   numeric(14,2) NOT NULL DEFAULT 0,
  equity        numeric(14,2) NOT NULL DEFAULT 0,
  data          jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_end, snapshot_type)
);

CREATE INDEX IF NOT EXISTS gl_balance_snapshots_period_idx ON gl_balance_snapshots(period_end DESC);

-- Transparent AVC work-mint chain
CREATE TABLE IF NOT EXISTS avc_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           bigserial UNIQUE,
  user_id       uuid REFERENCES auth.users(id),
  delta_avc     numeric(14,2) NOT NULL,
  balance_after numeric(14,2),
  work_type     text,
  order_id      text,
  invoice_id    text,
  public_note   text,
  prev_hash     text,
  entry_hash    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avc_ledger_user_idx ON avc_ledger(user_id, seq DESC);
CREATE INDEX IF NOT EXISTS avc_ledger_order_idx ON avc_ledger(order_id);

ALTER TABLE gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE avc_ledger ENABLE ROW LEVEL SECURITY;

-- Public read chart of accounts
DROP POLICY IF EXISTS "Public read gl accounts" ON gl_accounts;
CREATE POLICY "Public read gl accounts" ON gl_accounts FOR SELECT USING (true);

-- Owner / auditor read journal & snapshots
DROP POLICY IF EXISTS "Auditor read journal" ON gl_journal_entries;
CREATE POLICY "Auditor read journal" ON gl_journal_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Auditor read snapshots" ON gl_balance_snapshots;
CREATE POLICY "Auditor read snapshots" ON gl_balance_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auditor write snapshots" ON gl_balance_snapshots;
CREATE POLICY "Auditor write snapshots" ON gl_balance_snapshots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

-- Users see own AVC ledger rows
DROP POLICY IF EXISTS "User read own avc ledger" ON avc_ledger;
CREATE POLICY "User read own avc ledger" ON avc_ledger FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Service all accounting" ON gl_journal_entries;
CREATE POLICY "Service all accounting" ON gl_journal_entries FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service all snapshots" ON gl_balance_snapshots;
CREATE POLICY "Service all snapshots" ON gl_balance_snapshots FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service all avc ledger" ON avc_ledger;
CREATE POLICY "Service all avc ledger" ON avc_ledger FOR ALL USING (auth.role() = 'service_role');

-- Owner can read all profiles balance (for company view)
DROP POLICY IF EXISTS "Auditor read profiles" ON profiles;
CREATE POLICY "Auditor read profiles" ON profiles FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);