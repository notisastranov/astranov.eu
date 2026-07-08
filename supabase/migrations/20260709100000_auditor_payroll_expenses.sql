-- Payroll · rent · operating expenses · extended chart (ΕΛΠ-style)

INSERT INTO gl_accounts (code, name_el, name_en, category, sort_order) VALUES
  ('11', 'Τράπεζα', 'Bank', 'asset', 11),
  ('12', 'Εμπορεύματα', 'Inventory', 'asset', 12),
  ('20', 'Παγία', 'Fixed assets', 'asset', 20),
  ('41', 'Μισθοδοσία πληρωτέα', 'Payroll payable', 'liability', 41),
  ('42', 'Μισθώματα πληρωτέα', 'Rent payable', 'liability', 42),
  ('55', 'Φόρος εισοδήματος πληρωτέος', 'Income tax payable', 'liability', 55),
  ('61', 'Αποθεματικά', 'Reserves', 'equity', 61),
  ('62', 'Αποτελέσματα εις νέο', 'Retained earnings', 'equity', 62),
  ('63', 'Μερίσματα', 'Dividends', 'equity', 63),
  ('73', 'Λοιπά έσοδα', 'Other income', 'revenue', 73),
  ('60.01', 'Μισθοδοσία', 'Payroll expense', 'expense', 601),
  ('60.02', 'Ενοίκια', 'Rent expense', 'expense', 602),
  ('60.03', 'Αμοιβές οδηγών', 'Driver fees', 'expense', 603),
  ('60.04', 'Λοιπά έξοδα', 'Other opex', 'expense', 604),
  ('85', 'Φόρος εισοδήματος', 'Income tax expense', 'expense', 850)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS gl_employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  afm           text,
  role_title    text,
  gross_monthly numeric(12,2) NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gl_payroll_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month     text NOT NULL,
  employee_id      uuid REFERENCES gl_employees(id) ON DELETE CASCADE,
  gross            numeric(12,2) NOT NULL DEFAULT 0,
  employee_efka    numeric(12,2) NOT NULL DEFAULT 0,
  employer_efka    numeric(12,2) NOT NULL DEFAULT 0,
  income_tax       numeric(12,2) NOT NULL DEFAULT 0,
  net_pay          numeric(12,2) NOT NULL DEFAULT 0,
  employer_total   numeric(12,2) NOT NULL DEFAULT 0,
  posted           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_month, employee_id)
);

CREATE TABLE IF NOT EXISTS gl_operating_expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type  text NOT NULL CHECK (expense_type IN ('rent','utilities','insurance','marketing','other')),
  description   text,
  amount_net    numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate      numeric(5,4) NOT NULL DEFAULT 0.24,
  vat_amount    numeric(12,2) NOT NULL DEFAULT 0,
  amount_gross  numeric(12,2) NOT NULL DEFAULT 0,
  period_month  text NOT NULL,
  entry_date    date NOT NULL DEFAULT CURRENT_DATE,
  posted        boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gl_owners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  afm           text,
  share_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (share_pct >= 0 AND share_pct <= 100),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gl_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_operating_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auditor all employees" ON gl_employees;
CREATE POLICY "Auditor all employees" ON gl_employees FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Auditor all payroll" ON gl_payroll_runs;
CREATE POLICY "Auditor all payroll" ON gl_payroll_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Auditor all opex" ON gl_operating_expenses;
CREATE POLICY "Auditor all opex" ON gl_operating_expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Auditor all owners" ON gl_owners;
CREATE POLICY "Auditor all owners" ON gl_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.is_owner = true OR p.is_auditor = true))
);

DROP POLICY IF EXISTS "Service employees" ON gl_employees;
CREATE POLICY "Service employees" ON gl_employees FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service payroll" ON gl_payroll_runs;
CREATE POLICY "Service payroll" ON gl_payroll_runs FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service opex" ON gl_operating_expenses;
CREATE POLICY "Service opex" ON gl_operating_expenses FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service owners" ON gl_owners;
CREATE POLICY "Service owners" ON gl_owners FOR ALL USING (auth.role() = 'service_role');