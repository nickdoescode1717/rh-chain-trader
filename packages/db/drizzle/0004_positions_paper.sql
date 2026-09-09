-- Paper positions: track open simulated positions + sell-proposal fields.
-- Does NOT enable live trading or live sells. Default status remains non-executable.
-- Status values (app): simulated_open | alert_fired | sell_proposed | pending_nick
--   | approved | rejected | signer_handoff_stub | closed | disabled
-- Never auto-sell. No keys. Isolated signer is out of band.
-- See docs/POSITIONS.md

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS token_id uuid REFERENCES tokens(id),
  ADD COLUMN IF NOT EXISTS token_address text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS entry_price text,
  ADD COLUMN IF NOT EXISTS current_price text,
  ADD COLUMN IF NOT EXISTS pnl_abs text,
  ADD COLUMN IF NOT EXISTS pnl_pct real,
  ADD COLUMN IF NOT EXISTS thresholds jsonb,
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES purchase_proposals(id),
  ADD COLUMN IF NOT EXISTS last_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel text;

-- Keep legacy rows marked disabled; paper-only note.
UPDATE positions
SET note = COALESCE(NULLIF(note, ''), 'PAPER_POSITIONS_ONLY_NO_LIVE_SELLS')
WHERE status = 'disabled'
  AND note = 'DISABLED_PHASE1_NO_TRADING';

INSERT INTO audit_log (action, actor, detail)
VALUES (
  'migrate_positions_paper',
  '0004_positions_paper.sql',
  '{"chainId":4663,"note":"paper position columns added; no live sells; ENABLE_TRADING stays false"}'::jsonb
);
