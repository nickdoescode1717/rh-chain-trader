-- Strip FICTIONAL / non-hex demo wallets so wallet-watcher stays empty-ready.
-- Does not touch real watched wallets. Paper / research only.

DELETE FROM wallet_events
WHERE wallet_id IN (
  SELECT id FROM wallets
  WHERE address ILIKE '%FICTIONAL%'
     OR address !~ '^0x[0-9a-fA-F]{40}$'
);

DELETE FROM wallets
WHERE address ILIKE '%FICTIONAL%'
   OR address !~ '^0x[0-9a-fA-F]{40}$';

INSERT INTO audit_log (action, actor, detail)
VALUES (
  'migrate_strip_fictional_wallets',
  '0005_strip_fictional_wallets.sql',
  '{"note":"remove demo wallets so empty-ready watcher skips invalid hex; paper only"}'::jsonb
);
