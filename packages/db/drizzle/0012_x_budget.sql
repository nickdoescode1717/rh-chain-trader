CREATE TABLE IF NOT EXISTS x_request_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  reserved_credits integer NOT NULL CHECK (reserved_credits > 0),
  state text NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS x_request_budget_created ON x_request_budget(created_at);
CREATE TABLE IF NOT EXISTS x_response_cache (
  cache_key text PRIMARY KEY,
  payload jsonb,
  observed_at timestamptz,
  lease_id uuid REFERENCES x_request_budget(id),
  next_attempt_at timestamptz
);
CREATE TABLE IF NOT EXISTS x_provider_state (
  id integer PRIMARY KEY CHECK (id = 1),
  blocked_until timestamptz
);
INSERT INTO x_provider_state(id) VALUES(1) ON CONFLICT DO NOTHING;
