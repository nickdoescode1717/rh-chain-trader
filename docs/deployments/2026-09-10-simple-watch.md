# One-input watch deployment — 2026-09-10 UTC

Application revision: `a93f960fb1a31ec2bfcc30e4df1138f0347ebb76` on `codex/telegram-primary-research`.

Deployed API, collector and Telegram images to the existing Hetzner Compose stack. Applied additive migration 0011. Backup directory: `/root/rh-deploy-backups/20260910T132529Z-watch`; marker `watch-current`. Contains previous environment/Compose/image references, database dumps, and pre-cutover book/project snapshot. Existing database and Telegram state volumes preserved.

Validation:

- 107 relevant local tests passed (core 24, API 23, collector 29, Telegram 31); all affected TypeScript builds passed.
- Isolated PostgreSQL API tests passed: owner/service auth, input normalization, duplicates preserving reports/schedules/in-flight revision, unresolved website watches, pause propagation and no identity trust.
- Isolated collector tests passed: persisted research and candidate project mapping, hourly claim, pause during collection and prevention of existing-domain overwrite. The test harness ESM dependency resolution was corrected before passing; production was not changed during failing tests.
- Running API/collector/Telegram/Postgres verified. Telegram watch list rendered against the live API without sending a message. Unauthenticated watch creation rejected with 403.
- Public read-only website discovery of `trade.cv` found `tradedotcv`; no watch was registered and the existing paused project remained paused/unverified.
- Book comparison preserved 0.88 ETH cash, the same three holdings, ledger reconciliation and fill history. No test trades, identity approvals or production watch fixtures were created.

`WATCH_X_ENABLED=false`; TwitterAPI.io credential/setup and live response validation remain pending. Website discovery is available; unknown X-only watches persist waiting for a website. The older official-X graph scanner is unchanged. Identity gate and paper ledger remain enabled. All trading/submission flags remain false.

Desktop cleanup moved 33 loose helper/log/research/document files into `C:/Users/ncrim/Desktop/Desktop Files` (Bot Operations and Documents). App shortcuts, `rh-chain-trader`, `work`, and `.rh-chain-deploy-access` remain at their original paths. A move manifest is saved in that folder. New deployment helpers are also stored in Bot Operations.
