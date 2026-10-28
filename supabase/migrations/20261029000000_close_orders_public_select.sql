-- Midnight 2026-10-29: close open anon SELECT on orders to stop public data leak.
-- Keeps customer own, service_role, and anon INSERT for placing orders.
-- Does not drop login, booking, or other functions.

DROP POLICY IF EXISTS "Anon read order by vendor" ON orders;

-- Ensure RLS stays on
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Optional: if vendor dashboard needs to see their orders, add a restricted policy later via vendor_id match.
-- For now, no full public read.
