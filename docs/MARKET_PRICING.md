# Paper market pricing

Deployed application revision `4fea48846e1e950ab3850dc63132dc95bb5c2572` on 2026-09-10 UTC. API, collector and Telegram updated; `MARKET_PRICING_ENABLED=true` on API and collector. Real trading and submission remain disabled.

## Provider and selection

Uses the public [DEX Screener token-pairs API](https://docs.dexscreener.com/api/reference) with the `robinhood` chain slug. Robinhood's [network documentation](https://docs.robinhood.com/chain/connecting/) identifies mainnet as 4663 with ETH as its native token; the collector checks its configured RPC chain ID before collecting prices.

Only exact requested base-token addresses on Robinhood, quoted against the native ETH zero-address representation, are eligible. A matching symbol is never sufficient. `priceNative` in an arbitrary pool can represent USDG or another quote token, so those pools are excluded from this adapter. Current support intentionally excludes WETH and non-native-ETH pools.

Selection requires positive finite ETH/USD prices, at least $1,000 reported liquidity, positive reserves on both sides and trading activity within the provider's last-hour bucket. It chooses the deepest eligible pool, abstaining if another pool with at least a quarter of its liquidity differs by more than 25% in ETH or USD price. These are paper-price quality checks, not proof of issuer identity, pool safety, executable liquidity or a trading policy.

Each observation stores the chain, exact token, pool ID, source URL, ETH/USD prices, reported liquidity and local receipt time. The API does not provide an underlying price-update timestamp; `sourceUpdatedAt` stays null and Telegram explains this limitation. Recent receipt time is not a guarantee of a recent trade.

## Collection and entries

- Up to ten distinct open/pending-position token addresses per pass, least recently attempted first, followed by a 60-second pause. Pending proposals past their expiry are excluded. Larger queues can exceed freshness windows and then fail closed.
- Each request has an eight-second timeout and one-megabyte response cap. HTTP 429 stops the pass. Failures retain the last observation for reference but mark it unavailable for current valuation.
- Market observations older than 180 seconds are excluded from current P&L. Fresh-entry capture requires an observation no older than 90 seconds. Future timestamps are rejected.
- With pricing enabled, Telegram approval requires a successful eligible cached quote. If none is ready, the proposal stays pending and the bot asks the owner to retry. No automatic approval is scheduled.
- Approval, position and entry snapshot are committed together under a PostgreSQL proposal-row lock. Entry snapshots preserve quote, cost currency, unit price, estimated quantity and capture time. Memory state changes only after commit. Duplicate approval clicks cannot create two positions for that proposal.
- New ETH entries use ETH/token prices and new USD entries use USD/token prices; subsequent valuation uses the same denomination and recorded quantity. Fees, taxes, slippage and price impact are excluded, so these are paper estimates, not simulated executable fills.
- Manual overrides are disabled for market-snapshot positions. Legacy manual marks now persist their source and observation time. Legacy unknown entry prices are never overwritten with today's price.

## Verification and deployment

84 local tests passed across core, API, collector and Telegram; all five relevant package builds passed. Additional tests ran in an isolated temporary PostgreSQL database on the server, removed afterward. They verified concurrent approvals, immutable entry snapshots, hydration after clearing memory, stale-quote rejection, and forced insert failure rolling back approval/position/memory state.

Migration `0008_market_pricing.sql` adds entry/mark metadata and the market quote cache without rewriting old entries. Production reads confirmed fresh CRUMBS and STONKBROKER observations, source/timestamp detail cards, and unchanged missing legacy entries. All services were running with zero restarts after cutover. No production proposal was approved, rejected or repriced during tests.

Root-only backup: `/root/rh-deploy-backups/20260910T001715Z-market`, including prior configuration, git revision, database dump and rollback image tags. Production database restore was not rehearsed.

## Remaining limitations

This is one market-data provider; exact contract matching is not issuer verification. Legacy CRUMBS/STONKBROKER positions still lack entry prices, and PAPERDEMO has a placeholder. Existing equity accounting retains unpriced ETH positions at cost and excludes USD positions from ETH totals. Full durable budget/exposure accounting, executable quote simulation, exits, wallet swap classification and issuer/deployer verification remain separate priorities. TwitterAPI.io remains deferred.
