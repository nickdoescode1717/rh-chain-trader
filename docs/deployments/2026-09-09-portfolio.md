# Telegram portfolio update — 2026-09-09

Deployed revision `3722eae6c2942ad1d8e9df4969cc2bd7cccc9b15` on the existing `codex/telegram-primary-research` branch. Updated API and Telegram only; no database migration or credential changes. Trading remains paper-only.

## Changes

- `/positions`: compact five-position pages, invested amounts, P&L/value when supported, explicit missing-price reasons, refresh and detail buttons. `alert_fired` positions remain visible. The API no longer silently caps open positions at 40.
- Details retain the exact contract address, chain and position ID. Overview addresses are shortened for readability and token labels are bounded/sanitized. Names are display metadata, never identity verification.
- PostgreSQL hydration restores symbols from an exact chain/address token match or original proposal scores. Position payloads recalculate P&L without depending on a preceding balance request and expose its cost currency.
- `/balance`: cash, positions, equity, priced-position coverage and unrealized P&L. Unknown/placeholder marks do not masquerade as measured zero P&L. Equity using cost-basis fallbacks is labeled partial; USD holdings are excluded from ETH totals.
- Fill receipts remove implementation details. Large-move alerts link to positions instead of offering the nonfunctional sell action. Portfolio/research navigation edits the existing message, including harmless unchanged refreshes.

## Verification

- 23 Telegram tests and 20 API tests passed, covering signed ETH/USD gains/losses, zero marks, missing/placeholder/invalid prices, overflow, pagination, malicious labels, stale callbacks, edited-message behavior, restored metadata and more than 40 open holdings. API and Telegram TypeScript builds passed.
- Production Docker builds passed. Live API/database and rendered position-list, balance and detail cards verified without changing marks or submitting trades. Keyboards and Telegram length limits checked.
- All services running, zero restarts. Telegram briefly polled before the API was ready; retry behavior recovered and live API reads succeeded. Persistent fill-receipt history loaded successfully. Actual user interaction with the new edit-message buttons was not independently exercised.
- Live holdings show CRUMBS, STONKBROKER and PAPERDEMO. The first two lack entry prices; the demo has a placeholder. Accordingly all three show unavailable measured P&L. No historical prices were invented.

Backup: `/root/rh-deploy-backups/20260909T235518Z-portfolio`, root-only. Includes database dump, environment, prior Compose/git revision, tagged previous API/Telegram images and Telegram state snapshots. Database restoration was not rehearsed.

## Next backend priorities

1. Record source-backed entry price, quote currency, size/quantity and timestamp for every new paper fill. Evaluate whether historical records contain enough evidence to reconstruct old entries; otherwise keep them unknown.
2. Validate an exact chain/token market-data adapter and persist quote source, timestamp and freshness. Do not use name/ticker matches or infer issuer identity from a pool.
3. Persist mark provenance instead of inferring it from price equality after restart. Current manual P&L is only an estimate and excludes fees/slippage; quote currency/freshness are not captured in legacy positions.
4. Replace in-memory/dual-write paper accounting with transactional, durable balance/exposure reservations and tested concurrency/restart behavior before automated execution. Current cash reconstruction and no-op sell path are not a complete trading ledger.

TwitterAPI.io remains deferred. This release does not implement live market prices, token provenance verification, buys or sells.
