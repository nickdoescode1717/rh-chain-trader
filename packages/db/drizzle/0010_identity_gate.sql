ALTER TABLE purchase_proposals ADD COLUMN IF NOT EXISTS project_handle text;
CREATE TABLE IF NOT EXISTS identity_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_handle text NOT NULL REFERENCES research_projects(handle),
 domain text NOT NULL, source_url text NOT NULL, token_address text NOT NULL, deployer_address text NOT NULL, creation_tx_hash text NOT NULL,
 report jsonb, checked_at timestamptz, reviewed_at timestamptz, reviewed_by text, reviewed_source_hash text, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_claims_project ON identity_claims(project_handle);
CREATE TABLE IF NOT EXISTS identity_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid NOT NULL REFERENCES identity_claims(id), source_hash text NOT NULL,
 actor text NOT NULL, status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL
);
CREATE OR REPLACE FUNCTION identity_claim_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.project_handle,NEW.domain,NEW.source_url,NEW.token_address,NEW.deployer_address,NEW.creation_tx_hash)
 IS DISTINCT FROM ROW(OLD.project_handle,OLD.domain,OLD.source_url,OLD.token_address,OLD.deployer_address,OLD.creation_tx_hash)
 THEN RAISE EXCEPTION 'identity claim inputs are immutable; create a new claim'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS identity_claim_inputs_immutable ON identity_claims;
CREATE TRIGGER identity_claim_inputs_immutable BEFORE UPDATE ON identity_claims FOR EACH ROW EXECUTE FUNCTION identity_claim_immutable();
