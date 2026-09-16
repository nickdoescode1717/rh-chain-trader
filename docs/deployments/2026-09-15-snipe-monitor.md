# Longer launch monitoring and Telegram setup

Application `ec03c76211de0ce2cf76196e195b1da18fcf2ce9` deployed to the existing Hetzner API, collector and Telegram services on September 15, 2026. Pushed to `codex/telegram-primary-research`. No new schema migration, secret configuration change or live-mode activation.

New paper plans support 1–720 hours, default 24. After the initial ten-minute fast window, targeted Pons V2 monitoring continues about every five minutes until the approved expiry. Due deployers share requests. Leases, persistent cursors, bounded range fallback and catch-up protect against duplicate work and skipped ranges after failed reads. `/snipe` explains inputs, examples and unknown launch timing; plan cards provide actionable blocking reasons. See [usage and limits](../PAPER_SNIPER.md) and [the path to actual execution](../LIVE_EXECUTION_NEXT.md).

## Verification

- Builds passed for core, DB, API, collector and Telegram; 123 local tests passed (core 29, collector 32, API 23, Telegram 39).
- Five isolated, schema-only PostgreSQL fixture databases passed API/collector collection controls, paper sniper settlement, targeted monitoring and full paper ledger regression. This includes week-old launch detection, shared queries, provider outages, cursor catch-up, range fallback, lease persistence, 30-day approved expiry, exactly-once fills, rollback, restart, budget reservations and stop controls. No real provider requests or production fixture trades.
- Deployed Telegram handlers rendered `/snipe`, project-specific help and `/snipes`; the API rejected an unauthenticated Grok actor. Checks invoked handlers internally without sending Telegram test messages.
- Preserved 0.88 paper ETH, three existing holdings, historical fills, claims, project states and persisted collector cursors. No watches or snipe plans were created. Collection remained paused with chain monitoring off and both live execution flags false. Zero additional RPC/X calls were observed during the cutover verification interval.

## Recovery and remaining gaps

Backup: `/root/rh-deploy-backups/20260915T170943Z-snipe`; marker `/root/rh-deploy-backups/snipe-sept15-current`. Contains predeployment/cutover database dumps, env/Compose, prior image tags, cursor files and book snapshot. Local helper scripts are under `C:/Users/ncrim/Desktop/Desktop Files/Bot Operations`, prefixed `rh-snipe-sept15-`. They pin this exact revision; adapt and revalidate them for later deployments. Do not restore an older book over new fills. Old application versions reject newly drafted durations over 24 hours; any rollback must also account for changed monitoring behavior of existing armed plans.

This is paper monitoring and accounting. The adapter only discovers targeted Pons V2 events. Real route execution, realistic buy/sell simulation, isolated signing, automated exits and measured end-to-end launch latency remain outstanding. Collection was deliberately left stopped; commands being deployed do not mean the bot is currently scanning or purchasing tokens.
