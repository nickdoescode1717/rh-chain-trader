ALTER TABLE paper_sell_intents ADD COLUMN IF NOT EXISTS route_requested_at timestamptz;
ALTER TABLE paper_sell_intents ADD COLUMN IF NOT EXISTS route_attempt_at timestamptz;
ALTER TABLE paper_sell_intents ADD COLUMN IF NOT EXISTS route_checked_at timestamptz;
ALTER TABLE paper_sell_intents ADD COLUMN IF NOT EXISTS route_report jsonb;
CREATE INDEX IF NOT EXISTS paper_sell_intents_route_queue
  ON paper_sell_intents(route_requested_at)
  WHERE status IN ('route_quoting','route_confirming');
