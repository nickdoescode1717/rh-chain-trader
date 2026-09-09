# Desk Playbook — rh-chain-trader (Robinhood Chain 4663)

Living reference. Append new hints; do not leave learnings only in chat.
Last updated: 2026-09-09 (~03:57 UTC) / 2026-09-08 23:57 ET


## Nick CORRECTION (2026-09-09 ~03:56 UTC) — opportunity type
**Primary job:** Scan Crypto Twitter for **NEW platforms** gaining traction that are launching / about to launch **their own token** (Crumbs-class, early-Pons-class, STONK-class) on RH Chain **4663 only**.
**NOT the job:** Forever-watching every meme `TokenLaunched` on an established pad (do **not** treat "like Pons for firehose watch" as the goal unless Nick later says otherwise).
- CT new-platform discovery = **primary**
- Pad factories / `:13001` ingest = **corroboration tools** after a platform is identified
- Pattern library siblings: **Crumbs**, **early Pons**, **STONK**
- Manual CT discovery until X funded — no scrape / no X API

## Operating framework (Nick durable)
1. CT/docs = discovery of platforms to like — untrusted leads; no scrape; no X API until funded.
2. DD the PLATFORM first (docs, staging/dev, repos, on-chain provenance) before any launch watch.
3. Listen only on Nick-approved platforms — never escalate every TokenCreated; orphan/global launches low priority/ignore until registry.
4. On events: hard-reject fictional/seed, zero liq, honeypot flags, junk evidence, spam; score survivors only with opportunity / risk / evidence-confidence + sources.
5. Surface to CoS/Nick only clears; no buy proposals off weak evidence; paper only; Nick approves every buy.
6. Never hold keys, never sign/submit txs, never let web/X authorize trades.
7. On-chain tokens ≠ Robinhood brokerage listings — always distinguish.
8. Wallets (~400 elite early) and paid X = later layers; Crumbs = example pattern for future platforms, not a live chase (unless Nick reclassifies).
9. Coordinate with CoS; Coder for registry/auto-DD; Infra for `:13001` access.

## Detection checklist (SOP A–D)
### A. Discovery
- CT buzz about platform/app/protocol (not just ticker)
- Official domain / docs / staging
- Team/handles unverified until corroborated
- Capture sources + timestamps; no X scrape/API until funded

### B. Platform DD before listen
- On-chain 4663 vs brokerage
- Meme pad vs utility
- Docs / GitHub / staging / deployer provenance
- Factory / launch ABIs or token-only
- Risk flags
- Recommend watch / research more / skip — Nick OK before registry like

### C. Readiness after liked
- Listen only that platform’s factories
- Auto-DD + score gate; escalate clears only
- Paper; Nick approves buys
- Do not expand launch sources without score gate

### D. Anti-patterns
- Don’t snipe completed moves (Crumbs-class)
- Don’t treat same-name meme tokens as the platform
- Don’t enable factory listen from CT alone

## API access (Desk)
- Prod tunnel: `http://127.0.0.1:13001` (never `:3001` fictional stub)
- Poll `/health`, `/tokens`, `/protocols`, `/watchlist`
- Ignore FICTIONAL seed; prefer `source=onchain` / verified factories when present
- No `/events` yet — poll tokens/protocols

## Forward shortlist snapshot (2026-09-08; superseded in part by Nick correction)
Historical seed DD order was Pons → pools.trade → Uniswap (liquidity). **Nick correction:** do not treat established-pad firehose watch as the goal. Shortlist remains useful for *platform DD candidates* / corroboration tooling, not meme TokenLaunched subscriptions.
UNTRUSTED until on-chain corroboration; Nick approves any scoped watch.

## Section: Crumbs provenance (reference learning case)
Status: PATTERN ONLY — not a live snipe unless Nick reclassifies.

### Pre-signals
- `crumbs.robinhood.com` — Hansel & Gretel easter egg teaser under robinhood.com (fetched ~2026-09-09)
- CT `@crumbsfamily` (public page ~2026-09-09 03:51 UTC; soft login wall blocked full timeline): bio “Earn up to 5% back in stock tokens. Live on Robinhood Chain.”; site `crumbs.family`; location Robinhood; joined Sep 2026; ~12.5K followers; pinned “Crumbs and $CRUMBS are now live on Robinhood Chain.”
- Site `https://crumbs.family` — spend → Stock Token rewards; claims 75% fees buy back/burn $CRUMBS; demo wallet `0x7bE3…72Cf` (UI mock — not proven treasury)

### Token candidates (do not conflate)
- Hansel & Gretel (CRUMBS) `0xe0d05ea83582f97599211e9a321449adcbe05573` — Robinscout LaunchToken; **narrative link only** to Hansel teaser; NOT proven crumbs.family canonical
- Crumb The Goblin (CRUMB) `0x9F974Fdb7fDEF62853967D88D9dEdd17EdaaF936`
- Crumbcat (CRUMB) `0x5724ad861f8ae4c4a08905df48bd389945f2af61`
- PonsLauncherToken Crumb `0xb139449d…2771`
- Canonical crumbs.family $CRUMBS CA: `0x80baa4b3bfac6f4978700df824b1b3d98e889136` (**PROVEN** via site footer + DexScreener; see amend below)
- Hansel & Gretel remains collision only

### Contract ↔ people
- `@crumbsfamily` ↔ `crumbs.family`: tentative (link-in-bio)
- `crumbs.family` ↔ Robinhood Inc.: UNKNOWN / not proven
- Deployer / funding / multisig: UNKNOWN (explorer dig may amend)

### Early-knowable signals (order)
1. Odd `*.robinhood.com` teaser subdomain
2. CT platform bio + official domain
3. First-party product site + token economics claims
4. Then CA → deployer → factory (never CT alone)

### Reusable path
CT handle → official domain → team claims → deployer hunt → factory/token → corroboration (≥2 of site CA / docs / explorer). Anti-FP: ticker collisions, LaunchToken memes ≠ platform, Stock Tokens ≠ brokerage, subdomain ≠ affiliation proof.

## Append log
- 2026-09-09: Initial playbook created from framework + checklist + Crumbs provenance + shortlist snapshot.

### Amend — Hansel & Gretel (CRUMBS) Blockscout (2026-09-09 ~03:54 UTC)
Still **NOT proven** as crumbs.family / @crumbsfamily canonical $CRUMBS — name-collision candidate with strong narrative motif only.

| Field | Value |
| --- | --- |
| Token | Hansel & Gretel (CRUMBS) |
| CA | `0xE0D05EA83582f97599211E9a321449aDCbe05573` |
| Supply | 1,000,000,000 |
| Holders | 511 |
| Type | ERC-20 `LaunchToken` (partially verified via Blockscout bytecode DB; solc 0.8.30) |
| Deployer | `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB` |
| Creation tx | `0x5e5286d9d277b997ab5cf3ccaccac40770581aca9c7116cfd7864351620c5fca` |
| Created | 2026-07-10 16:02:13 UTC (09:02:13 -07:00) |

**Timeline note:** Create date ~2026-07-10 aligns with CT-cited “crumbs.robinhood.com / early RH meme week” narrative — still does **not** prove affiliation with crumbs.family product.

**Still UNKNOWN:** funding parents of deployer, factory/pad that emitted LaunchToken, link to @crumbsfamily, canonical crumbs.family CA if different.

- 2026-09-09: Amended Hansel & Gretel CRUMBS deployer/create tx from Blockscout (narrative candidate only).

## Append — 2026-09-09 ~03:55 UTC ingest live
- Infra redeploy `80b674e` green on `:13001`.
- Verified factories: Pons V2 `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` (verifiedOnchain true); Uniswap v4 PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`; pools.trade entry `0x0000ffffbe8efe702c8703ae3477ff5de3d319c0`.
- First real `/tokens`: 22 Pons V2 meme launches + 3 fictional seeds. No scores/evidence in API yet.
- Desk action: catalog for corroboration only; do **not** treat as Pons firehose watch goal (Nick correction). Escalate only Crumbs/early-Pons/STONK-class new-platform own-token clears.

### Amend — canonical $CRUMBS CA PROVEN (2026-09-09 ~03:56 UTC)
**Canonical (crumbs.family site-linked):** `0x80baa4b3bfac6f4978700df824b1b3d98e889136` (checksum `0x80bAa4b3bfAC6f4978700dF824B1B3d98e889136`)
- Name/symbol: Crumbs / CRUMBS; 18 decimals; 1B supply (DexPaprika)
- First indexed ~2026-09-08T23:57:57Z; primary Uni V4 ETH pool created ~same second
- Proof: crumbs.family footer copy-CA control + DexScreener websites → crumbs.family / X crumbsfamily
- Create tx / deployer / factory: **still UNKNOWN** (Blockscout/RPC blocked)
- pools.trade lists token but `unsupported: true` — pad attr
