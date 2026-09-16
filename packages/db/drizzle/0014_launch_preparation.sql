ALTER TABLE watch_targets ADD COLUMN IF NOT EXISTS launch_flag boolean NOT NULL DEFAULT false;
ALTER TABLE watch_targets ADD COLUMN IF NOT EXISTS launch_report jsonb;
CREATE TABLE IF NOT EXISTS launch_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL CHECK (chain_id = 4663),
  token_address text NOT NULL,
  deployer_address text NOT NULL,
  creation_tx_hash text NOT NULL,
  factory text NOT NULL,
  block_number integer NOT NULL,
  block_hash text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chain_id, token_address, creation_tx_hash)
);
CREATE INDEX IF NOT EXISTS launch_deployments_deployer ON launch_deployments(deployer_address);
CREATE INDEX IF NOT EXISTS launch_deployments_token ON launch_deployments(token_address);
