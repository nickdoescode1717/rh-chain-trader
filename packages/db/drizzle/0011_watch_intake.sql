CREATE TABLE IF NOT EXISTS watch_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_key text NOT NULL UNIQUE,
  handle text,
  domain text,
  project_handle text REFERENCES research_projects(handle),
  enabled boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  discovery jsonb,
  report jsonb,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (handle IS NOT NULL OR domain IS NOT NULL)
);
