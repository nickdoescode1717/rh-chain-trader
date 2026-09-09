-- Paper purchase proposals: phone-ready approval payload columns.
-- Does NOT enable live trading. Default status remains away from execute.
-- Status values used by app: pending_nick | approved | rejected | expired | cancelled | disabled
-- Never auto-execute. Isolated signer is out of band.

ALTER TABLE purchase_proposals
  ADD COLUMN IF NOT EXISTS token_address text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS slippage_bps integer,
  ADD COLUMN IF NOT EXISTS exits jsonb,
  ADD COLUMN IF NOT EXISTS scores jsonb,
  ADD COLUMN IF NOT EXISTS sources jsonb,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Keep legacy rows marked disabled; do not invent live statuses.
UPDATE purchase_proposals
SET note = COALESCE(NULLIF(note, ''), 'PAPER_PROPOSALS_ONLY_NO_AUTO_EXECUTE')
WHERE status = 'disabled'
  AND note = 'DISABLED_PHASE1_NO_TRADING';

INSERT INTO audit_log (action, actor, detail)
VALUES (
  'migrate_purchase_proposals_paper',
  '0003_purchase_proposals_paper.sql',
  '{"chainId":4663,"note":"paper proposal columns added; no live execute; ENABLE_TRADING stays false"}'::jsonb
);
