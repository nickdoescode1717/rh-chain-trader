CREATE TABLE IF NOT EXISTS research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  domain text NOT NULL,
  category text NOT NULL DEFAULT 'unknown',
  enabled boolean NOT NULL DEFAULT true,
  report jsonb,
  last_researched_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- User-supplied example, not a verified token or authorization to buy.
INSERT INTO research_projects (handle, domain, category)
VALUES ('tradedotcv', 'trade.cv', 'utility') ON CONFLICT (handle) DO NOTHING;
INSERT INTO social_accounts (handle, label, watch_following, watch_followers)
VALUES ('tradedotcv', 'User supplied platform example; token identity unverified', true, false)
ON CONFLICT (handle) DO NOTHING;
