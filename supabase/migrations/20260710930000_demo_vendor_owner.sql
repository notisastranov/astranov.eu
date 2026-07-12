-- Demo vendors: attach owner for instant AVC payout loop on driver accept

UPDATE vendors
SET owner_id = (SELECT id FROM profiles WHERE is_owner = true ORDER BY created_at ASC LIMIT 1),
    updated_at = now()
WHERE id IN ('demo-pitogyra', 'demo-kafeneio', 'demo-minimarket')
  AND owner_id IS NULL
  AND EXISTS (SELECT 1 FROM profiles WHERE is_owner = true);