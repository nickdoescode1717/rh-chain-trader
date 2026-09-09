-- Robinhood Chain research agent — Phase 1 schema
-- Chain ID 4663. No live trading tables are enabled for execution.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL,
  -- NEEDS_ONCHAIN_VERIFICATION: factory addresses may be null until verified
  factory_address text,
  website text,
  notes text,
  verified_onchain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid REFERENCES protocols(id),
  address text NOT NULL,
  name text,
  abi_hint text,
  chain_id integer NOT NULL DEFAULT 4663,
  is_proxy boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contracts_chain_addr ON contracts(chain_id, address);

CREATE TABLE IF NOT EXISTS tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  decimals integer NOT NULL DEFAULT 18,
  category text NOT NULL DEFAULT 'unknown',
  chain_id integer NOT NULL DEFAULT 4663,
  logo_url text,
  description text,
  is_watchlisted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tokens_chain_addr ON tokens(chain_id, address);

CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id),
  protocol_id uuid REFERENCES protocols(id),
  source text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  confidence real NOT NULL DEFAULT 0.5,
  url text,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  label text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_address ON wallets(address);

CREATE TABLE IF NOT EXISTS wallet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  token_id uuid REFERENCES tokens(id),
  event_type text NOT NULL,
  tx_hash text,
  block_number integer,
  amount text,
  metadata jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id),
  framework text NOT NULL,
  opportunity real NOT NULL,
  risk real NOT NULL,
  evidence_confidence real NOT NULL,
  breakdown jsonb NOT NULL,
  rationale text NOT NULL,
  scored_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id),
  title text NOT NULL,
  summary text NOT NULL,
  body_markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- DISABLED Phase 1 stubs — application must not execute trading against these
CREATE TABLE IF NOT EXISTS purchase_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id),
  status text NOT NULL DEFAULT 'disabled',
  note text NOT NULL DEFAULT 'DISABLED_PHASE1_NO_TRADING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disabled',
  note text NOT NULL DEFAULT 'DISABLED_PHASE1_NO_TRADING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disabled',
  note text NOT NULL DEFAULT 'DISABLED_PHASE1_NO_TRADING',
  created_at timestamptz NOT NULL DEFAULT now()
);
