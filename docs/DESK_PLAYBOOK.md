# Desk Playbook — rh-chain-trader (Robinhood Chain 4663)

Living reference. Append new hints; do not leave learnings only in chat.
Last updated: 2026-09-09 (~03:58 UTC) / 2026-09-08 23:58 ET

## Nick CORRECTION (2026-09-09 ~03:56 UTC) — opportunity type
**Primary job:** Scan Crypto Twitter for **NEW platforms** gaining traction that are launching / about to launch **their own token** (Crumbs-class, early-Pons-class, STONK-class) on RH Chain **4663 only**.
**NOT the job:** Forever-watching every meme `TokenLaunched` on an established pad (do **not** treat "like Pons for firehose watch" as the goal unless Nick later says otherwise).
- CT new-platform discovery = **primary** (co-equal with watched-wallet buys — see Operating framework)
- Pad factories / `:13001` ingest = **corroboration tools** after a platform is identified
- Pattern library siblings: **Crumbs**, **early Pons**, **STONK**
- Manual CT discovery until X funded — no scrape / no X API

## Nick HARD RULES (2026-09-09 ~03:58 UTC)
1. We are **NOT** scanning every token launch.
2. **CT first always** — even Pons memecoins: CT traction lead → then corroborate on-chain (pad/factory). **Never** pad-first firehose. Watched-wallet buys are co-equal lead source with CT.
3. **Meme vs utility = SEPARATE scoring frameworks**
   - Meme: attention / quality / narrative / liq / distribution / sellability → then opp / risk / evidence-confidence
   - Utility: product / usage / dev / token necessity / FDV / emissions / competition → then opp / risk / evidence-confidence
4. **New-platform class** (Crumbs / early-Pons / STONK) remains primary hunt; established-pad memes only if **CT-led**.

## Operating framework (Nick durable)
1. CT/docs = discovery of platforms to like — untrusted leads; no scrape; no X API until funded.
2. Lead sources are **co-equal: CT + watched-wallet buys** (Nick supplies wallet list later). Pads corroborate only — not every launch.
3. DD the PLATFORM first (docs, staging/dev, repos, on-chain provenance) before any launch watch.
4. Listen only on Nick-approved platforms — never escalate every TokenCreated; orphan/global launches low priority/ignore until registry.
5. On events: hard-reject fictional/seed, zero liq, honeypot flags, junk evidence, spam; score survivors only with opportunity / risk / evidence-confidence + sources.
6. Surface to CoS/Nick only clears; no buy proposals off weak evidence; paper only; Nick approves every buy.
7. Never hold keys, never sign/submit txs, never let web/X authorize trades.
8. On-chain tokens ≠ Robinhood brokerage listings — always distinguish.
9. Coordinate with CoS; Coder for registry/auto-DD + wallet listener; Infra for `:13001` access. Paid X later.

## Detection checklist (SOP A–D)
### A. Discovery
- CT buzz about platform/app/protocol (not just ticker) **or** watched-wallet buy in configured ranges
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
- Listen only that platform's factories
- Auto-DD + score gate; escalate clears only
- Paper; Nick approves buys
- Do not expand launch sources without score gate

### D. Anti-patterns
- Don't snipe completed moves (Crumbs-class)
- Don't treat same-name meme tokens as the platform
- Don't enable factory listen from CT alone

## API access (Desk)
- Prod tunnel: `http://127.0.0.1:13001` (never `:3001` fictional stub)
- Poll `/health`, `/tokens`, `/protocols`, `/watchlist`, `/watched-wallets`, `/wallet-events` (as Coder lands them)
- Ignore FICTIONAL seed; prefer `source=onchain` / verified factories when present

## Forward shortlist snapshot (2026-09-08; superseded in part by Nick correction)
Historical seed DD order was Pons → pools.trade → Uniswap (liquidity). **Nick correction:** do not treat established-pad firehose watch as the goal. Shortlist remains useful for *platform DD candidates* / corroboration tooling, not meme TokenLaunched subscriptions.
UNTRUSTED until on-chain corroboration; Nick approves any scoped watch.

## Section: Crumbs provenance (reference learning case)
Status: PATTERN ONLY — not a live snipe unless Nick reclassifies.

### Pre-signals
- `crumbs.robinhood.com` — Hansel & Gretel easter egg teaser under robinhood.com (fetched ~2026-09-09)
- CT `@crumbsfamily` (public page ~2026-09-09 03:51 UTC): bio stock-token rewards; site `crumbs.family`; location Robinhood; joined Sep 2026; ~12.5K followers; pinned "Crumbs and $CRUMBS are now live on Robinhood Chain."
- Site `https://crumbs.family` — spend → Stock Token rewards; 75% fees buyback/burn claims; demo wallet `0x7bE3…72Cf` (UI mock)

### Token candidates (do not conflate)
- Canonical crumbs.family $CRUMBS: `0x80baa4b3bfac6f4978700df824b1b3d98e889136` (**PROVEN**)
- Hansel & Gretel (CRUMBS) `0xE0D05EA83582f97599211E9a321449aDCbe05573` — collision/narrative only; deployer `0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB`; create tx `0x5e5286d9d277b997ab5cf3ccaccac40770581aca9c7116cfd7864351620c5fca` at 2026-07-10 16:02:13 UTC
- Also collisions: Crumb The Goblin, Crumbcat, PonsLauncher Crumb, Crumbs Family clones, Solana clones

### Contract ↔ people / gaps
- `@crumbsfamily` ↔ `crumbs.family`: tentative
- Robinhood Inc affiliation / create tx+deployer for canonical CA / factory: **UNKNOWN**

### Reusable path
CT handle → official domain → team claims → deployer hunt → factory/token → corroboration (≥2 of site CA/docs/explorer). Never CT alone.

## Pattern library
- **Crumbs** (reference) — above
- **Early Pons** — TBD deepen (platform token debut, not meme firehose)
- **STONK** — TBD deepen

## Append log
- 2026-09-09: Initial playbook; Hansel Blockscout amend; ingest live `80b674e`; canonical CA proven; Nick correction + HARD RULES locked; lead sources co-equal CT + watched wallets.
- 2026-09-09: Crumbs create-path (Pons V2 launchAndBuy) + anti-pattern SOP (chase event deployer / creator, not factory); CT Alpha Watchlist seeded.

### Amend — Crumbs create path / tweet CA (2026-09-09)
- Tweet/site CA match: canonical $CRUMBS `0x80baa4b3bfac6f4978700df824b1b3d98e889136`
- Create path: Pons V2 `launchAndBuy` (TokenLaunched) via factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
- Create tx: `0xf49fbbb1…` (Desk: full hash if known in prior notes; else leave truncated as Desk provided)
- Event deployer: `0x00607eC8…`
- Creator: `0x3711ceA4…`
- **Pattern lesson:** platform own-token launched *via* an established pad — pad corroborates; **CT/site was the lead**. Do not treat Pons firehose as the opportunity.

### Anti-pattern — pad launches obscure deployers
Explorer “token creator” often = factory/router (e.g. Pons launchAndBuy). **SOP:** chase `launchAndBuy` caller / TokenLaunched event deployer + funding parents + fee/token recipients — **NOT** the factory.
- Crumbs hunt: `0x00607eC8…` / `0x3711ceA4…`, not factory `0x7eD598Bc…`.

## CT Alpha Watchlist (Desk)
- `@crumbsfamily` — yes (primary CT lead for Crumbs pattern)
- `t.me/crumbsfamily` — yes
- `@magaman` — maybe
- Third-party early callers — UNKNOWN (soft login wall / unverified)
