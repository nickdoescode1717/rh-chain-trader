# Next work to reach actual launch buys

The deployed bot can conditionally buy in its paper ledger. Finding a CA does not establish a tradeable market, an executable route or permission to spend real funds. Live transaction submission remains disabled.

## 1. Build and validate one venue's execution adapter

Start with the venue behind a real, reviewed candidate that the existing Pons V2 watcher can detect. Verify its current mainnet contracts, ABI, routing and launch phases from official sources and chain evidence; do not assume the launch factory is the swap router. A launch could trade on a bonding curve before a DEX pool exists.

Implement exact-chain/token buy and sell quotes, calldata construction, output minimum, deadline, gas estimate and a buy-then-sell simulation against the same chain state. Report actual route coverage, token restrictions, taxes and failures. An isolated call to sell from a wallet with no balance is not a valid round-trip test. Neither a successful simulation nor source verification guarantees future sellability.

Acceptance: fixture and fork tests prove successful trades, trading-disabled launches, insufficient liquidity, unexpected token/router, slippage breach, taxes and reverted buy/sell paths. The paper engine records route-derived quantities and costs with their block/time, instead of relying solely on indexed market prices and fixed fee assumptions. No signing is needed for this step.

## 2. Measure the whole launch path in paper mode

Use one owner-selected project and reviewed deployer. Record detection, official CA discovery, Telegram identity review, confirmation, quote, simulated submission and fill timestamps. Keep failed/missed launches and costs in the report. Rehearse provider outage, quota exhaustion, restart, duplicate event and reorg recovery.

The current five-minute slow polling, hourly research, manual CA source review and ten-minute entry window can miss launches. Resolve these measured bottlenecks before claiming reliable sniping. A future prelaunch source approval must pin a reviewed official source and tightly constrained identity rules; it must not trust any CA an LLM or copied account supplies. Research watches and spending approvals remain separate.

Robinhood documents mainnet 4663 and provider WebSocket endpoints, plus a public sequencer feed. A feed/subscription adapter with durable backfill may reduce detection delay; provider support, billing and real recovery behavior need testing. Public RPC is rate-limited and not recommended for production. [Robinhood connection documentation](https://docs.robinhood.com/chain/connecting/), checked September 15, 2026. Read-only calls, gas estimates, transaction submission and receipt lookup are distinct RPC operations. [Ethereum JSON-RPC documentation](https://ethereum.org/developers/docs/apis/json-rpc/).

## 3. Add isolated signing and explicit live authorization

Implement a separately secured signer that independently enforces the Telegram-approved token/route, maximum spend, daily and total exposure, slippage, gas and expiry. Add durable nonce allocation, one intent per launch, transaction hash persistence, uncertain-broadcast reconciliation, receipt/finality/reorg handling and restart recovery. Never blindly retry a buy whose broadcast outcome is unknown.

Define exits and failure handling before enabling live entries: automatic sells require approved rules and their own simulation/receipt checks. Make the effect of stop explicit for new buys, pending transactions and existing positions. Keep keys out of the research VPS, bot prompts, repository and chat.

Only after these tests pass should the owner select and approve live limits, custody and initial funding through the supported secure setup. No mainnet token purchase, wallet funding or live-mode change is authorized by a research score or this roadmap.
