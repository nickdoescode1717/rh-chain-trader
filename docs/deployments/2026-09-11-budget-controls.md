# X budget and collection controls — 2026-09-11 UTC

Deployed application `f512a0819be4ceddf576b74fce903aaf17b826d2` to API, collector and Telegram. Additive migrations 0012/0013 applied. Backup: `/root/rh-deploy-backups/20260911T000751Z-controls`, marker `controls-current`. Existing paper state and Telegram volume preserved; both old collector cursor files copied to the new persistent `deploy_collector_state` volume.

The owner reported exhausted Alchemy quota and requested an off switch. The collector was physically stopped first. Inspection found unconditional 15-second factory polling, metadata requests per launch, per-minute pricing chain checks, and nonpersistent container cursors. Exact prior Alchemy compute-unit consumption was not available and is not inferred from request counts.

Current verified state: **collection STOPPED, chain OFF**. `WATCH_X_ENABLED=true` prepares the authorized US$0.50 X pipeline, but the durable global pause blocks it. `/run` resumes website/X research with chain off; `/chainon` explicitly enables RPC collection. Old official-X scanner remains disabled; Grok enrichment remains disabled. Trading/submission flags remain false; identity gate and durable paper ledger remain enabled.

Implemented and verified:

- US$0.50 rolling-24-hour X reservation ceiling, daily profile and hourly/six-hour timeline caches shared across watches, persistent leases/backoff, and `/usage` display. Reservations conservatively include failed/crashed requests and are not provider invoices.
- Owner-authenticated `/stop`, `/run`, `/chainon`, `/chainoff`, `/status`, durable pause, network gates and cancellation signals.
- Five-minute broad chain polling floor, 2,000-block catch-up batches, reused launch token metadata, chain-ID cache and persistent cursors. RPC request counter/cap is 2,000 per UTC day, not a compute-unit or dollar limit.
- 109 relevant local tests and all affected builds passed. Isolated PostgreSQL tests passed for watch APIs/collector, X-budget concurrency/child-process restart/TTL/error/cap behavior, and collection API/transport blocking. No external calls in those tests.
- Live verification invoked `/stop` through the Telegram client's configured owner credentials and rendered the budget card without sending test messages. All four services were running while collection remained paused. Fifteen-second observation showed zero new RPC attempts and zero X reservations; no Alchemy or paid-X probe was made after the stop request.
- Both cursor files matched their backups. Paper cash remained 0.88 ETH, three holdings and history unchanged, and ledger reconciled. No production test trades or identity approvals.

TwitterAPI.io key is installed collector-only; a profile lookup passed before this deployment. Live recent-post response validation remains outstanding until research is resumed. No secret was printed or committed. The local one-time key file supplied by the owner still exists outside the repository.

See [X budget](../X_BUDGET.md) and [collection controls](../COLLECTION_CONTROLS.md) for limits and commands. Do not resume collection automatically during later maintenance.
