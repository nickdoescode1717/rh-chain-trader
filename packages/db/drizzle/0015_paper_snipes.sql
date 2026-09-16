CREATE TABLE IF NOT EXISTS paper_snipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), terms jsonb NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','armed','filled','cancelled','expired')),
 armed_at timestamptz, expires_at timestamptz, checked_at timestamptz, monitor_attempt_at timestamptz, monitor_block integer,
 reason text NOT NULL DEFAULT 'review_required', token_address text,
 proposal_id uuid REFERENCES purchase_proposals(id), fill_id uuid REFERENCES paper_fills(id),
 CHECK(terms->>'mode' = 'paper' AND (terms->>'chainId')::integer = 4663)
);
CREATE INDEX IF NOT EXISTS paper_snipes_status ON paper_snipes(status);
CREATE OR REPLACE FUNCTION paper_snipe_terms_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.terms IS DISTINCT FROM OLD.terms OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
 THEN RAISE EXCEPTION 'snipe terms are immutable; create a new plan'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS paper_snipe_terms_immutable ON paper_snipes;
CREATE TRIGGER paper_snipe_terms_immutable BEFORE UPDATE ON paper_snipes FOR EACH ROW EXECUTE FUNCTION paper_snipe_terms_immutable();
