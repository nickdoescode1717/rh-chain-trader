# Paper snipe deployment — 2026-09-11 UTC

Application `63aafd59755ca508f90a385ac95c4541c690039e` deployed to API, collector and Telegram from `codex/telegram-primary-research`. Migration `0015_paper_snipes.sql` applied. `PAPER_SNIPER_ENABLED=true` on API/collector exposes paper-plan functionality; no plans were created or armed. Real trading/submission remain false.

See [PAPER_SNIPER.md](../PAPER_SNIPER.md) for exact workflow, resource limits and remaining live-execution gaps. `/snipe` drafts immutable owner-reviewed paper plans, `/snipes` lists them, reserved capital is visible in `/balance`, and collection stop/chain-off cancels armed plans. A rotating ten-second Pons V2 monitor is active only for plans within ten minutes of arming; the existing RPC guard remains in force. The five-second DB evaluator requires a fresh exact mainnet identity, canonical deployment time, price/market checks and one atomic paper fill.

## Evidence

- 119 local tests: core 28, collector 31, Telegram 37, API 23. All affected packages and three production images built successfully.
- Nine isolated PostgreSQL scripts passed in separate schema-only fixture databases: API watch, collector watch, X budget, launch DD, API collection, collector collection, API snipes, targeted snipe monitor and prior paper-ledger regression.
- The initial isolated run omitted the seeded X-provider state from its schema-only clone. It correctly failed closed with `x_budget_unavailable`; the test harness was corrected to apply migration 0012's seed and all nine scripts passed. No production service was changed by that failed run.
- Automatic paper entry tests covered Telegram owner authorization, rejected testnet/live modes, immutable policy terms, reservations competing with manual buys, stale identity, deployment-time/price/liquidity conditions, injected fill failure rollback, one fill across concurrent evaluations and process restart, expiry and stop cancellation.
- Targeted monitor tests used fake RPC only: no idle calls, exact factory/deployer filters, concurrent poll lease, durable cursor, ten-minute expiry, chain off and daily RPC cap.
- Deployed Telegram handlers rendered `/snipe`, `/snipes`, and balance with zero reserved funds. The untrusted/Grok draft request returned 403. These were internal handler/API checks, not synthetic Telegram messages.
- Production comparisons preserved 0.88 ETH cash, three legacy positions, fill history, project settings, identity claims, zero one-input watches and both collector cursors. There are zero paper snipe plans. Collection stayed stopped, chain off, and no new X/RPC requests were observed during the post-cutover window.

Backup `/root/rh-deploy-backups/20260911T190408Z-snipe`, marker `/root/rh-deploy-backups/snipe-current`. Includes prior environment/compose, image rollback tags, database dumps, cursors and book snapshot. No restore rehearsal performed. Local helpers are in Desktop Files/Bot Operations: rh-snipe-build-test.py, rh-snipe-retest.py, rh-snipe-cutover.py, rh-snipe-verify.py; they pin this application hash and require adaptation for future deployments.

Remaining: owner-approved live paper trial once collection can resume, actual provider/launch latency measurement, additional factories/direct-deployer discovery, executable router/sellability simulation, live signer and live risk policy. The Grok testnet automation remains an external lead source; it is not automatically ingested and cannot authorize an entry. This deployment makes no first-block or real-purchase claim.
