ALTER TABLE positions ADD COLUMN IF NOT EXISTS ledger_managed boolean NOT NULL DEFAULT false;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS remaining_quantity numeric(78,18) CHECK (remaining_quantity >= 0);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS remaining_cost numeric(78,18) CHECK (remaining_cost >= 0);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS realized_pnl numeric(78,18) NOT NULL DEFAULT 0;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS position_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS paper_accounts (
 currency text PRIMARY KEY CHECK(currency IN ('ETH','USD')), cash numeric(78,18) NOT NULL CHECK(cash >= 0), realized_pnl numeric(78,18) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS paper_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE, currency text NOT NULL REFERENCES paper_accounts(currency),
 position_id uuid REFERENCES positions(id), kind text NOT NULL, delta numeric(78,18) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paper_fills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE, position_id uuid NOT NULL REFERENCES positions(id),
 currency text NOT NULL, side text NOT NULL CHECK(side IN ('buy','sell')), execution jsonb NOT NULL, quote jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paper_sell_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), position_id uuid NOT NULL REFERENCES positions(id), position_version integer NOT NULL,
 percent integer NOT NULL CHECK(percent IN (25,50,100)), actor text NOT NULL, currency text NOT NULL,
 minimum_net numeric(78,18) NOT NULL CHECK(minimum_net > 0), preview jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
 fill_id uuid REFERENCES paper_fills(id), expires_at timestamptz NOT NULL
);
CREATE OR REPLACE FUNCTION paper_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'paper financial records are append-only'; END $$;
DROP TRIGGER IF EXISTS paper_ledger_immutable ON paper_ledger;
CREATE TRIGGER paper_ledger_immutable BEFORE UPDATE OR DELETE ON paper_ledger FOR EACH ROW EXECUTE FUNCTION paper_append_only();
DROP TRIGGER IF EXISTS paper_fills_immutable ON paper_fills;
CREATE TRIGGER paper_fills_immutable BEFORE UPDATE OR DELETE ON paper_fills FOR EACH ROW EXECUTE FUNCTION paper_append_only();
-- Account initialization/adoption is performed once under the ledger lock using configured paper capital.
