ALTER TABLE positions ADD COLUMN IF NOT EXISTS entry_snapshot jsonb;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS mark_source text;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS mark_observed_at timestamptz;
CREATE TABLE IF NOT EXISTS market_quotes (
  token_address text PRIMARY KEY,
  chain_id integer NOT NULL DEFAULT 4663 CHECK (chain_id = 4663),
  quote jsonb,
  last_attempt_at timestamptz NOT NULL,
  last_error text
);
-- Legacy entry prices have no reliable provenance; never backfill entry snapshots.
