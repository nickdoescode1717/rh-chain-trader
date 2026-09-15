# Read-only Pons route checks

Deployed application `9ce5a1d58671df3582f70b8debce678fc54e7000` to the existing Hetzner API, collector and Telegram services on September 15, 2026. Branch `codex/telegram-primary-research`; additive migration `0016_route_checks.sql`. No environment/secret changes or live-mode activation.

The **Test buy + sell** button on paper plan cards requests a bounded diagnostic against the reviewed token and deployer. It checks native-ETH Pons V2 curve/token/factory bytecode and simulates a buy, exact approval and sell without signatures or broadcast. It records actual outputs/fees, immediate resale loss and execution gas estimates. It rejects active launch-tax windows instead of underquoting taxes using a later simulated timestamp. See [route behavior and limitations](../ROUTE_CHECKS.md).

## Verification

- Builds passed for core, DB, collector, API and Telegram. 128 local tests passed: core 29, collector 36, API 23 and Telegram 40.
- Six fresh isolated schema-only PostgreSQL fixture databases passed API/collector collection controls, paper sniper settlement, targeted launch monitoring, route-job lifecycle and full ledger regression. The route tests cover no idle/stopped paid requests, stale identity, durable concurrent leases, PostgreSQL timestamp precision, a superseded in-flight request, process-independent deduplication, expiry and no arming/financial mutations.
- Two mechanical mainnet round trips passed using the public RPC, not Alchemy. The final adapter passed at parent block 63,994,953 in 17 read-only requests. A separate ERC-20 quote launch was rejected as unsupported. The initial discovery/two-candidate probe used 22 calls and capability testing used three. No real wallet was funded or token bought; only hypothetical EVM state was changed within simulation. No issuer was trusted or production identity claim created from these probes.
- Production verification rendered the route button and historical-result card internally, checked help/list/balance and rejected unauthenticated Grok route requests. No Telegram test messages or production plans were created.
- Preserved 0.88 paper ETH, three holdings, fill history, reviewed claims, project/watch settings and collector cursors. Collection remained stopped, chain off and both live flags false. Zero new production RPC/X calls were observed during cutover verification.

## Backup and limitations

Backup `/root/rh-deploy-backups/20260915T220615Z-route`, marker `/root/rh-deploy-backups/route-current`. Includes database/cutover dumps, env/Compose, old running-image tags, cursors and book snapshot. Helpers are `rh-route-build-test.py`, `rh-route-cutover.py` and `rh-route-verify.py` in Desktop Files/Bot Operations. The first staged revision failed a fixture timestamp test and never replaced running services; the corrected revision passed all six scripts. The backup checkout hash can therefore refer to the failed staging revision while its running-image tags refer to the previous deployed application `ec03c76211de0ce2cf76196e195b1da18fcf2ce9`. Use the saved images for rollback, preserve additive schema, and never roll accounting back over newer fills.

Route reports are diagnostics and do not gate the current automatic paper entries or change the fixed-fee ledger model. Fresh simulations need a new explicitly described execution policy before their quantities/costs can drive settlement. Real signing, user funding/nonce checks, full L1 gas costs, other quote assets, graduated venues and automated exits remain outstanding. Command availability does not mean collection is running.
