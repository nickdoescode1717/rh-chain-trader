ALTER TABLE paper_snipes ADD COLUMN IF NOT EXISTS route_requested_at timestamptz;
ALTER TABLE paper_snipes ADD COLUMN IF NOT EXISTS route_attempt_at timestamptz;
ALTER TABLE paper_snipes ADD COLUMN IF NOT EXISTS route_checked_at timestamptz;
ALTER TABLE paper_snipes ADD COLUMN IF NOT EXISTS route_report jsonb;
