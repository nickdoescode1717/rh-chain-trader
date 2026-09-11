# Launch preparation deployment — 2026-09-11 UTC

Application revision: `13f09af576dc18aa950f97a508d05d2a87189462`, branch `codex/telegram-primary-research`.

Deployed API, collector and Telegram on the existing Hetzner stack after a root-only backup and six isolated PostgreSQL integration scripts passed. Applied additive migration `0014_launch_preparation.sql`. The initial attempt was blocked before execution by automatic approval review reporting exhausted Codex usage; the owner restored usage and authorized continuation. The resumed build, tests, deployment and verification succeeded.

## Delivered

- Telegram `/launch @account` / website and watch-card flag controls.
- Hourly additional DD using existing X responses and up to six more linked public project pages, with source-backed address roles.
- Exact Pons V2 deployment observations and DB-only reconciliation to flagged token/deployer candidates.
- Untrusted identity drafts only for exact, uniquely declared token/chain evidence on the registered domain; existing Telegram owner review and canonical identity gate remain required.
- Deduplicated launch-preparation alerts and explicit missing/unsupported checks. No signer, automatic trade or low-latency sniper was added. See [LAUNCH_PREPARATION.md](../LAUNCH_PREPARATION.md).

## Validation

- 116 local tests passed: core 27, collector 31, Telegram 35, API 23. Workspace builds and all three production image builds passed.
- Six isolated database scripts passed: API watch intake, collector watch collection, X budget/cache, launch reconciliation, API collection controls and collector transport controls. No real X/RPC requests in tests.
- Launch integration covered duplicate events, multiple tokens from one deployer, exact-CA-only drafts, conflicts, watch/global pause, concurrent workers, process restart, revoked drafts, stale evidence and zero RPC calls during reconciliation.
- Running Telegram handlers rendered `/launch` instructions, `/projects` and the $0.50 `/usage` card. Unauthenticated/Grok launch-flag mutation returned 403. These were internal handler/API checks, not synthetic messages sent through Telegram.
- Post-deployment comparisons preserved 0.88 ETH paper cash, three legacy positions, fill history, project monitoring state and identity claims. There were zero one-input watches before/after; no production fixtures or automatic flags were created.
- Both collector cursor files matched their backups. Collection remained paused and chain monitoring off; 15-second observation showed no new RPC or X requests. Trading and transaction submission flags remain false.

Backup: `/root/rh-deploy-backups/20260911T183718Z-launch`; marker `/root/rh-deploy-backups/launch-current`. Contains prior environment/compose, image rollback tags, database dumps, cursor copies and pre-cutover book/watch snapshot. No restore was performed or rehearsed.

Remaining acceptance: actual flagged-account research after the owner resumes collection, real launch matching after chain monitoring resumes, additional deployment adapters and low-latency policy-controlled paper/live execution. Do not automatically resume collection during maintenance.
