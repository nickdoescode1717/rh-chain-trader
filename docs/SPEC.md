# Robinhood Chain Research & Trading Agent — Technical Specification

**Status:** Historical, incomplete draft v0.1 (2026-09-08). Current requirements, superseding scope changes and implementation status are in [PRODUCT_ALIGNMENT.md](PRODUCT_ALIGNMENT.md). Historical ecosystem/access claims below have not been reverified by the latest code review.

**Current target scope:** Research automation → manual or policy-controlled automatic buys → preapproved rule-based sells. Implementation remains paper only.
**Primary chain:** Robinhood Chain mainnet (chain ID `4663`)

---

## 0. Product restatement (clear and constrained)

Build a **research-first crypto agent** that:

1. Continuously discovers candidate tokens and protocols on **Robinhood Chain** (on-chain activity, launchpads, public docs/repos, curated trader wallets, and—where budget allows—X/social signals).
2. Investigates contracts, deployers, liquidity, and public development signals with **source-linked, timestamped evidence**.
3. Scores opportunities with **separate opportunity / risk / evidence-confidence** scores and distinct meme vs utility frameworks.
4. Produces actionable **reports and purchase proposals**.
5. **Never buys without your explicit, time-bounded approval**; revalidates before execution.
6. Automates sells **only** under rules you pre-approve; keys and signing stay **outside** any language model.
7. Treats websites, docs, and social posts as **untrusted data** that cannot override trading rules or authorize transactions.

Automatic buying is now a requested target feature, following Nick's 2026-09-09 instruction. The older per-buy-approval description above describes the initial mode; configured automatic mode and preapproved exits require policy, paper validation and isolated execution before activation.

This is **not**:

- A guaranteed early-entry / 4× return system.
- A sniper that can buy priority against FCFS sequencer arrival (see §1).
- A system that splits wallets to evade launch taxes, per-wallet caps, or allowlists.
- Coverage of tokens that are merely **listed in the Robinhood brokerage app** but not deployed/traded on Robinhood Chain.

---

## 1. Ecosystem verification (assumptions challenged)

### 1.1 What Robinhood Chain is (verified)

| Fact | Status | Sources |
|------|--------|---------|
| Public EVM-compatible Ethereum L2 | **Verified** | [docs.robinhood.com/chain](https://docs.robinhood.com/chain/) |
| Built on Arbitrum Dedicated Blockchains / Orbit (Nitro); settles to Ethereum with blob DA | **Verified** | Official docs; Decrypt (updated 2026-09-05); Dwellir overview |
| Mainnet chain ID `4663`; testnet `46630` | **Verified** | [Connecting docs](https://docs.robinhood.com/chain/connecting/) |
| Gas token = ETH (no separate chain gas token) | **Verified** | Official docs |
| Permissionless contract deployment | **Verified** | Official docs |
| Mainnet launch ~2026-07-01; public testnet ~2026-02-10 | **Verified** (secondary reporting aligned with docs) | Decrypt; Dwellir |
| Explorer | **Verified** | `https://robinhoodchain.blockscout.com` |
| Public RPC (rate-limited) | **Verified** | `https://rpc.mainnet.chain.robinhood.com` |
| Recommended production RPC | **Verified** | Alchemy; also QuickNode, Blockdaemon, dRPC, Validation Cloud, Dwellir (archive) |
| Sequencer feed / sequencer endpoints published | **Verified** | Connecting docs |

### 1.2 Critical design constraint: FCFS sequencing

Official docs: transactions are ordered **first-come, first-served by arrival at the sequencer**. Users **cannot** buy priority by paying higher fees.

**Implication for “early entry”:** Success depends on latency to the sequencer, connection quality, and submission timing—not priority gas auctions. MEV / sniping playbooks from tip-based chains **do not transfer cleanly**. Treat “guaranteed early placement” as **unsupported**.

### 1.3 On-chain apps vs Robinhood brokerage listings (must separate)

| Concept | Meaning | Agent handling |
|---------|---------|----------------|
| **On Robinhood Chain** | Contract deployed / liquidity / trading on chain ID 4663 | In scope |
| **Listed on Robinhood (brokerage/app)** | Asset available in Robinhood’s product UI; may be Stock Token, crypto listing, or marketing surface | **Out of scope** unless also verified on-chain |
| **Stock Tokens / RWAs** | Tokenized equity exposure products; jurisdiction-restricted; not meme launchpad tokens | Separate catalog; usually **not** “early meme” targets |

Example of the trap: Cash Cat was both a chain meme and later discussed as listed in Robinhood’s app. The agent must store `on_chain_verified` and `brokerage_listed` as **independent flags**.

### 1.4 Launchpads and protocols actually relevant to early tokens

| Project | Role | Confidence | Notes |
|---------|------|------------|-------|
| **Pons** | Memecoin launchpad (fixed ~1B supply into trading pool); dominant early meme volume/fees | **High** (multiple secondary reports + DefiLlama fee rankings cited in press) | Primary discovery source for meme launches |
| **Pools.trade (Uniswap)** | Competing zero-fee launchpad (reported early Aug 2026) | **Medium–High** (press) | Confirm factory addresses from official Uniswap/RH sources before coding |
| **Noxa** | Early rival launchpad; reported stopped new launches ~2026-07-11 | **Medium** (press) | Historical / inactive registry entry |
| **Uniswap V3/V4** | Primary public AMM / liquidity layer | **High** (official ecosystem table) | Core swap + pool discovery |
| **Arcus** | Spot (Stock Tokens) + perps (waitlist historically) from dYdX/Robinhood Crypto | **High** (official + press) | More RWA/spot than memepad |
| **Lighter** | Perps DEX | **High** (official) | Perps, not launchpad |
| **Morpho** | Lending | **High** (official) | TVL context; not launchpad |
| **Rialto** | PropAMM / aggregator | **High** (official) | Routing |
| **LayerZero** | Bridging | **High** (official) | Funding / provenance traces |
| **Chainlink** | Oracles | **High** (official) | Price feeds where available |
| **Alchemy / Zerion / Allium / CoinGecko / TRM** | Infra / data / risk | **High** (official partner list) | Prefer these over inventing scrapers |

**Unverified / do not invent:** A complete authoritative list of *all* factory addresses, fee schedules, and anti-snipe mechanics must be pulled from each project’s docs + verified on-chain before production monitors. Treat press fee/volume numbers as **directional**, not as backtest inputs.

### 1.5 Gas subsidy window (time-sensitive)

Robinhood has covered gas for qualifying Robinhood Wallet activity under an offer reported to expire **~2026-09-29** (Decrypt). After expiry, launch/trade economics change. Agent configs must include `post_subsidy_cost_model` and not bake “free gas” into strategy assumptions.

### 1.6 Access verification for *this* assistant (Grok Bot / Coder)

| Capability | Available now? | Notes |
|------------|----------------|-------|
| GitHub connector | **Yes** (connected in this chat) | Repos, issues, PRs |
| Official X/Twitter API | **No connector installed** | Cannot assume search, historical posts, or following-list APIs work here |
| Browser (box) | **Yes** (manual/GUI workflows) | Not a substitute for reliable X API at scale |
| On-chain RPC | **Not yet provisioned** | Need Alchemy (or similar) API key + archive for indexing |
| Signing / custody | **Must never live in the LLM** | Separate signer service / hardware / MPC |

**X/Twitter reality (2026):** Official self-serve X API is pay-per-use / credit-based. Recent search is typically limited (often ~7 days on self-serve). Full-archive search is generally **Enterprise / sales-led** or third-party. Following/followers reads are billable per resource. Continuous monitoring of many accounts + keyword firehose is a **budget and product decision**, not a free built-in.

---

## 2–15 and Appendix A

*(Full body continues in batch file `/tmp/rh-push-batches/batch_0.json` entry `docs/SPEC.md` — restoring complete file in follow-up if truncated.)*

**MVP stack preference (verified-only):** Alchemy/QuickNode RPC + sequencer feed awareness → Bitquery/Goldsky/Dune for discovery → Blockscout verify → Uniswap API/Universal Router for quotes → add Pons/Pools.trade only after address verification.
