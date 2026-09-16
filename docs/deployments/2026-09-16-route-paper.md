# Route-derived paper entries

Deployed application `54f1f380d21aa72dafe9be77f159a940018f3687` to the existing Hetzner API, collector and Telegram services on September 16, 2026. Branch `codex/telegram-primary-research`; existing additive migrations `0015_paper_snipes.sql` and `0016_route_checks.sql`, with no new schema or secret changes.

New `/snipe` drafts use immutable policy v2. Telegram shows curve spend, maximum gross token price, a fixed gas allowance (default 0.0001 ETH), a 10% maximum immediate round-trip loss before gas and the plan duration. Arming reserves spend plus the full allowance. Once exact reviewed mainnet identity is fresh, the evaluator automatically queues a bounded Pons V2 native-ETH simulation. DEX indexing is not required for entry.

A fill requires a fresh passing report tied to the exact plan, request, reviewed source and canonical deployment. It records simulated quantity, base fee and creator/launch tax; price, resale-loss and estimated buy-gas limits must pass. The paper ledger conservatively charges the full approved gas allowance and commits proposal, fill, position, cash debit and plan state together. There is no fixed-fee fallback. Old version-1 plans retain their approved reference-price policy.

## Verification

- Full workspace build passed. 134 local tests passed: core 32, collector 36, API 23 and Telegram 43.
- Seven fresh isolated schema-only PostgreSQL databases passed collection controls, version-1 sniper regression, policy-v2 route settlement, targeted monitoring, route-job lifecycle and full ledger regression.
- Policy-v2 coverage includes spend-plus-gas reservations, automatic request deduplication, no market-index dependency, no fallback fill, identity/report/request binding, deployment ordering, report expiry, price/10% loss/gas rejection, changed identity, transaction rollback, concurrent/restarted exactly-once fill, route quantity/cost persistence, partial-exit cost allocation, stop cancellation and malformed-policy fail-closed behavior.
- Post-deploy verification exercised Telegram help/list/card formatting internally without sending messages or creating plans. Grok/unauthenticated plan and route requests remained rejected.
- Preserved 0.88 paper ETH, three existing holdings, history, projects, claims, watches and collector cursors. Production has zero plans. Collection remained stopped, chain monitoring off and both live flags false. No new production RPC or X requests were observed during cutover verification.

The first staging run found an invalid legacy test fixture missing its historical liquidity field. That run stopped before production changed. The corrected fixture plus a runtime fail-closed policy check passed all seven isolated suites before deployment.

## Backup and limits

Backup `/root/rh-deploy-backups/20260916T135848Z-route-paper`, marker `/root/rh-deploy-backups/route-paper-current`. It includes the database and cutover dumps, environment/Compose files, previous running-image tags, cursors, book snapshots and the exact tested/deployed commit marker. Local helpers are `rh-route-paper-build-test.py`, `rh-route-paper-cutover.py` and `rh-route-paper-verify.py` under Desktop Files/Bot Operations.

This remains paper-only. Simulation uses an unfunded hypothetical wallet and excludes L1 data fees, ordering competition, normal signature/nonce validation and future price changes. It covers only ungraduated native-ETH Pons V2 curves and blocks an active launch-tax window. P&L is unavailable until a supported market quote appears. Manual exits still use the reference-price model; automatic route-based exits, other venues, isolated signing, broadcast/receipt recovery and real funding remain outstanding.
