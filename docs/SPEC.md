# Robinhood Chain Research & Trading Agent — Technical Specification

**Status:** Draft v0.1 (2026-09-08, America/Toronto)  
**Scope:** Research automation → human-approved buys → rule-based sells  
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

Fully autonomous buying is **out of scope** until paper trading and validation succeed.

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

PLACEHOLDER_CONTINUE