CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  x_user_id text UNIQUE,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  watch_following boolean NOT NULL DEFAULT true,
  watch_followers boolean NOT NULL DEFAULT false,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_polled_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  source_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  source_url text NOT NULL,
  text text NOT NULL,
  addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_signals_observed ON social_signals (observed_at DESC);
CREATE INDEX IF NOT EXISTS social_signals_addresses ON social_signals USING gin (addresses);
