# Telegram-approved paper launch entries

This implements automatic **paper** entry under an explicit, immutable Telegram-approved plan. It does not sign, submit or purchase real tokens. `ENABLE_TRADING` and `ENABLE_TX_SUBMISSION` remain false. `PAPER_SNIPER_ENABLED` controls plan APIs/evaluation and the targeted collector; it does not arm a plan.

## Use with the Grok scout

Keep the daily testnet scout in Grok. Transfer a selected project by using `/launch @account` or `/launch project.com` in Telegram, review the DD and establish its intended mainnet deployer. The Grok automation is not connected directly to this API and cannot arm plans.

Robinhood official documentation confirms mainnet **4663** and testnet **46630**: [network configuration](https://docs.robinhood.com/chain/connecting/), checked 2026-09-11. A testnet contract address never establishes its mainnet equivalent. An owner, creator, first funder and shared CREATE2 factory are different roles; keep their evidence separate. A balance lookup failure must be unknown, not zero. Missing search results mean mainnet launch status is unknown, not proven unlaunched. A scout score is not execution authority.

1. `/snipe @account ETH_BUDGET MAX_PRICE_ETH DEPLOYER [HOURS]` creates a reviewable paper plan. Use the intended mainnet deployer address; a shared CREATE2 or Pons factory is rejected. All inputs remain untrusted until independent identity checks pass.
2. Read the card and press **Arm paper plan** within ten minutes. This pins the project domain, expected deployer, mainnet network, exact paper spend, maximum modeled unit price, $1,000 minimum quoted liquidity, and expiry (1–720h; default 24h). Existing plans keep their original approved expiry.
3. Arming requires collection and chain monitoring already enabled. It reserves paper ETH atomically; manual buys and other plans cannot spend that reservation. At most five plans can be armed, one per project. No production plan is automatically created or armed during deployment.
4. During each plan's first ten minutes, the collector checks on ten-second ticks; after that it continues about every five minutes until the approved expiry. Up to five due deployers share a head read and one Pons V2 event query using exact indexed deployer topics. A synchronized slow batch typically adds about 576 RPC requests/day plus chain-ID checks, retries and catch-up; staggered plans can cost more. This shares the 2,000-request daily cap with other chain work, so it is not a guaranteed full-day allowance. Provider cooldown, global pause and cancellation still apply. No eligible plan means no extra RPC calls. Cursors and in-flight leases persist across restarts.
5. The existing DD/identity pipeline must find the exact official mainnet CA declaration, match canonical direct/Pons V2 deployment and obtain source review through Telegram. A deployer-only match is never enough. The evaluator requires exactly one current reviewed claim, the approved deployer/domain, fresh identity evidence and a canonical block timestamp after arming. It never repurposes testnet verification as mainnet verification.
6. The API evaluates armed plans every five seconds using database snapshots. Quotes are collected through the existing bounded market loop. The quote must be fresh (90s), exact chain/token/native-ETH, sufficiently liquid and below the owner's limit **including modeled slippage**. Entry expires ten minutes after deployment. A token already held or filled by a prior snipe is not bought again.
7. A successful plan atomically creates one proposal, paper fill, position and ledger debit, then releases the reservation by marking the plan filled. Concurrency/restarts cannot double-fill. Failures roll back all financial records. `/snipes` and persistent Telegram alerts show status; `/balance` shows reserved versus available funds. Exits remain the existing manual paper sell flow.

`/stop`, `/chainoff` and `/run` cancel armed plans. `/chainon` does not re-arm them. Cancellation and automatic fill use the same book lock, so a stop that commits first prevents a subsequent fill. A fill already committed cannot be undone by stop. Paper reservation expiry does not alter recorded cash.

## Limits

This is a conditional paper entry and bounded launch monitor, not first-block execution. Real latency includes provider availability, polling cadence, website/X refresh, source review, twelve-confirmation identity checks and market indexing. A ten-second event poll is not a ten-second fill promise. Public RPC endpoints are rate-limited and not recommended for production by Robinhood; the existing configured provider remains unchanged.

Targeted reads cover at most 20,000 blocks with a 32-block overlap. A new plan starts with a bounded 20,000-block lookback; it is not an archival scanner. Existing cursors never jump forward over an unread range. A range-limit error allows one smaller 2,000-block retry; successful partial scans continue on ten-second ticks within the shared budget. Provider errors or malformed responses do not advance cursors. Smaller provider limits, long outages and exhausted budgets can still prevent timely detection; the ten-minute entry window is never extended to manufacture a late fill.

## Unknown launch date and command example

`/launch @account` creates an ongoing research watch with no scheduled expiry while enabled; collection must also be enabled. If the deployer is still unknown, keep this watch and review its DD. It does not authorize purchases. Once the intended mainnet deployer is established, use `/snipe @account` for the full input guide.

Example layout, with illustrative amounts: `/snipe @account 0.01 0.000001 DEPLOYER_WALLET 168`. Replace `DEPLOYER_WALLET` with the actual intended mainnet deployer address. This reserves 0.01 paper ETH for one purchase at no more than 0.000001 ETH per token, valid for seven days after arming. The final number is hours: 24 for a day, 168 for a week, 720 for 30 days. It is not the token CA. Expiry releases the reservation; the research watch continues, and renewed trade authorization requires another owner-approved plan.

`/snipe` explains each field, the difference between total spend and unit price, and the sequence from discovery to draft, chain monitoring, arming and identity review. Cards explain blocking checks and their next actions. Nothing in the guide automatically resumes collection, trusts a candidate or arms a plan.

Pons V2 is the only automatic targeted event adapter. Existing direct deployment identity evidence can qualify a paper plan, but this change does not add direct-deployer transaction discovery. Other launchpads, router quotes, executable buy/sell simulation, tax/permission/liquidity-lock checks, mempool/sequencer strategies and isolated live signing remain missing. The paper model uses 0.3% fee and 0.5% slippage; gas, launch taxes and actual sellability are not simulated. No live success/profitability claim is made.

Collection remains stopped and chain monitoring off during development/deployment. Enabling the feature makes commands available; the owner must separately resume collection and approve any plan.

## Validation

Migration `0015_paper_snipes.sql` provides immutable terms and durable state; the September 15 extension needs no new migration. Unit tests cover scope/duration validation, malformed RPC results and Telegram help/approval/deduplication. Isolated database tests cover authorization, testnet/live rejection, capital reservations versus manual buys, price/liquidity/freshness/launch-time gates, rollback, single fills, process restart, 30-day expiry and stop cancellation. A separate fake-RPC integration covers week-old plans, batched target filters, persistent cursors/leases, bounded catch-up/range fallback, provider failures, expiry, no-idle calls and chain/cap controls. Run the existing ledger regression after this change.
