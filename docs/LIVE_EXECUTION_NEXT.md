# Next work to reach actual launch buys

As of September 16, the first adapter below and its route-derived policy-v2 paper entry are implemented for native-ETH Pons V2 curves. Fresh reports are bound to Telegram-approved limits and reviewed identity; exact quantities/fees/tax plus a fixed gas allowance are recorded. DEX indexing is no longer required for these entries. The remaining work is to prove the complete launch path, add route-based exits and build isolated signing/recovery before any live enablement.

The deployed bot can conditionally buy in its paper ledger. Finding a CA does not establish a tradeable market, an executable route or permission to spend real funds. Live transaction submission remains disabled.

## 1. Build and validate one venue's execution adapter

Start with the venue behind a real, reviewed candidate that the existing Pons V2 watcher can detect. Verify its current mainnet contracts, ABI, routing and launch phases from official sources and chain evidence; do not assume the launch factory is the swap router. A launch could trade on a bonding curve before a DEX pool exists.

Implement exact-chain/token buy and sell quotes, calldata construction, output minimum, deadline, gas estimate and a buy-then-sell simulation against the same chain state. Report actual route coverage, token restrictions, taxes and failures. An isolated call to sell from a wallet with no balance is not a valid round-trip test. Neither a successful simulation nor source verification guarantees future sellability.

Acceptance achieved for the native-ETH Pons V2 route through verified-bytecode fixtures, read-only mainnet simulations and isolated database settlement tests. ERC-20 quote assets, graduated V4 pools and other venues still need separate adapters.

## 2. Measure the whole launch path and exits in paper mode

Use one owner-selected project and reviewed deployer. Record detection, official CA discovery, Telegram identity review, confirmation, route request, simulated submission and fill timestamps. Keep failed/missed launches and costs in the report. Rehearse provider outage, quota exhaustion, restart, duplicate event and reorg recovery. Add route-derived paper sells before treating the paper P&L as execution-realistic; current exits use the reference-price model.

The current five-minute slow polling, hourly research, manual CA source review and ten-minute entry window can miss launches. Resolve these measured bottlenecks before claiming reliable sniping. A future prelaunch source approval must pin a reviewed official source and tightly constrained identity rules; it must not trust any CA an LLM or copied account supplies. Research watches and spending approvals remain separate.

Robinhood documents mainnet 4663 and provider WebSocket endpoints, plus a public sequencer feed. A feed/subscription adapter with durable backfill may reduce detection delay; provider support, billing and real recovery behavior need testing. Public RPC is rate-limited and not recommended for production. [Robinhood connection documentation](https://docs.robinhood.com/chain/connecting/), checked September 15, 2026. Read-only calls, gas estimates, transaction submission and receipt lookup are distinct RPC operations. [Ethereum JSON-RPC documentation](https://ethereum.org/developers/docs/apis/json-rpc/).

## 3. Add isolated signing and explicit live authorization

Implement a separately secured signer that independently enforces the Telegram-approved token/route, maximum spend, daily and total exposure, slippage, gas and expiry. Add durable nonce allocation, one intent per launch, transaction hash persistence, uncertain-broadcast reconciliation, receipt/finality/reorg handling and restart recovery. Never blindly retry a buy whose broadcast outcome is unknown.

Define exits and failure handling before enabling live entries: automatic sells require approved rules and their own simulation/receipt checks. Make the effect of stop explicit for new buys, pending transactions and existing positions. Keep keys out of the research VPS, bot prompts, repository and chat.

Only after these tests pass should the owner select and approve live limits, custody and initial funding through the supported secure setup. No mainnet token purchase, wallet funding or live-mode change is authorized by a research score or this roadmap.
