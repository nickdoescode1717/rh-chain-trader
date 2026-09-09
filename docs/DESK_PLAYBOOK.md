# Desk Playbook — rh-chain-trader (Robinhood Chain 4663)

Living reference. Append new hints; do not leave learnings only in chat.
Last updated: 2026-09-09 (~04:08 UTC) / 2026-09-09 00:08 ET


## Nick CORRECTION (2026-09-09 ~03:56 UTC) — opportunity type
**Primary job:** Scan Crypto Twitter for **NEW platforms** gaining traction that are launching / about to launch **their own token** (Crumbs-class, early-Pons-class, STONK-class) on RH Chain **4663 only**.
**NOT the job:** Forever-watching every meme `TokenLaunched` on an established pad (do **not** treat “like Pons for firehose watch” as the goal unless Nick later says otherwise).
- CT new-platform discovery = **primary**
- Pad factories / `:13001` ingest = **corroboration tools** after a platform is identified
- Pattern library siblings: **Crumbs**, **early Pons**, **STONK**
- Manual CT discovery until X funded — no scrape / no X API

## Operating framework (Nick durable)
1. CT/docs = discovery of platforms to like — untrusted leads; no scrape; no X API until funded.
2. Lead sources are **co-equal: (1) CT and (2) watched-wallet buys** — not CT-only. DD the PLATFORM/token from those leads (docs/staging/dev/repos/on-chain) before any scoped watch. Pad factories = corroboration only. Wallet list from Nick later.
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
- pools.trade lists token but `unsupported: true` — pad attribution UNKNOWN
- Hansel & Gretel CRUMBS `0xE0D05EA8…5573` remains **collision / narrative motif only** — NOT canonical
- Additional collisions catalogued (Crumbs Family clones, Crumbcat, Goblin, PonsLauncher Crumb, Solana clones) — anti-FP mandatory
- Robinhood Markets affiliation: UNKNOWN / not proven
- 2026-09-09: Canonical $CRUMBS CA proven via crumbs.family: 0x80baa4b3bfac6f4978700df824b1b3d98e889136

## Pattern library — sibling case studies
### Crumbs (reference) — see Crumbs provenance section
New platform/product + own token $CRUMBS (`0x80baa4b3…9136` site-canonical).

### Early Pons (sibling — TBD deepen)
Pons itself was once the “new pad launching / with platform token” opportunity. Watching every Pons V2 meme launch forever is **not** that opportunity. Deepen: CT debut timeline, $PONS (or platform token) provenance, what was knowable early. Status: placeholder for Desk research.

### STONK (sibling — TBD deepen)
STONK-class = another new-platform / own-token CT traction example on RH Chain. Capture: handle, domain, CA, timeline, early signals. Status: placeholder — Desk to research next.

## Append — 2026-09-09 framework correction
- Nick: do NOT treat like-Pons firehose as goal; CT new-platform→own-token is the opportunity type.

## Nick HARD RULES (2026-09-09 ~03:58 UTC)
1. We are **NOT** scanning every token launch.
2. **CT first always** — even Pons memecoins: CT traction lead → then corroborate on-chain (pad/factory). **Never** pad-first firehose.
3. **Meme vs utility = SEPARATE scoring frameworks**
   - Meme: attention / quality / narrative / liq / distribution / sellability → then opp / risk / evidence-confidence
   - Utility: product / usage / dev / token necessity / FDV / emissions / competition → then opp / risk / evidence-confidence
4. **New-platform class** (Crumbs / early-Pons / STONK) remains primary hunt; established-pad memes only if **CT-led**.

- 2026-09-09: Locked Nick HARD RULES (CT-first; no every-launch scan; separate meme/utility frameworks).

## Nick HARD UPDATE — lead sources (2026-09-09 ~03:59 UTC)
Leads come from **(1) CT** and **(2) watched wallets** as **co-equal** sources (not CT-only).
- Pads/factories = **corroboration only**, never the primary feed.
- When wallet-buy events exist: treat like CT leads → DD token → check other watched wallets → score meme vs utility separately → escalate clears only.
- Still: no every-launch scanning.

- 2026-09-09: Lead sources = CT + watched wallets; pads corroborate only.

- 2026-09-09: Lead sources co-equal CT + watched wallets (not CT-only); pads corroborate only.

### Amend — canonical $CRUMBS create path + tweet (2026-09-09 ~04:03 UTC)
**Tweet** https://x.com/crumbsfamily/status/2097474961191391550 (public page ~Sep 8, 2026 4:59 PM local display):
- Text claims Crumbs + $CRUMBS live on RH Chain; CA `0x80baa4b3bfac6f4978700df824b1b3d98e889136`; stock-token rewards via receipts; crumbs.family
- Establishes **same CA as site-canonical** — hard corroboration CT↔site↔token

**On-chain create (Blockscout):**
| Field | Value |
| --- | --- |
| CA | `0x80baa4b3bfac6f4978700df824b1b3d98e889136` |
| Creation tx | `0xf49fbbb1469e7b807c88f55f28c23e859c3a445c7b274578899451b9f5b91bf9` |
| Method | `launchAndBuy` via `PonsV2LaunchAndBuy` `0xe33E9E479dF8802cb0866d5d05258bEc4cF62948` |
| Timestamp | 2026-09-08 16:57:56 -07:00 (≈ 23:57:56 UTC) |
| Factory event | `TokenLaunched` from Pons V2 `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` |
| Event deployer | `0x00607eC8622cf64Cf6735090891d5870a1598Fe4` |
| Creator shown on token page | `0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42` |
| Curve | `0x801b339a…1175`; graduation threshold 4.2 ETH |

**Learning (pattern):** Crumbs used an **established pad (Pons V2)** to launch the **platform’s own token** — still Crumbs-class (new platform + own token), pad = corroboration not the lead. CT/site announced CA; on-chain confirms Pons V2 `launchAndBuy`.

**Still UNKNOWN:** funding parents of event deployer / creator EOAs; whether creator≠event deployer implies router/relayer; Robinhood Inc affiliation.

- 2026-09-09: Canonical CRUMBS create tx + Pons V2 TokenLaunched + tweet CA match.

## Anti-pattern — pad launches obscure deployers (Nick, 2026-09-09 ~00:05 ET)
Pad launches (e.g. Pons `launchAndBuy`) often make the **token creator on the explorer = factory/router**, not the human.
**SOP:** chase:
1. `launchAndBuy` **caller** / tx `from`
2. `TokenLaunched` **event deployer** (indexed)
3. **Funding parents** of those EOAs
4. **Fee / token recipients** (feeWallet, creator cuts, LP beneficiaries)
**Do NOT** treat the factory address as “the person.”
Crumbs example: factory `0x7eD598Bc…` ≠ operator; chase event deployer `0x00607eC8…` and creator `0x3711ceA4…` (+ funding).

- 2026-09-09: Anti-pattern pad creator=factory; chase launchAndBuy caller/event deployer/funding/fee recipients.

## CT Alpha Watchlist (seeded from Crumbs) — 2026-09-09 ~00:06 ET
**Purpose:** CT radar for *new-platform* leads (separate from on-chain watched wallets). Not buy signals — leads still need platform DD + corroboration.
**Constraint:** Public pages only; no X API / scrape / login bypass. Soft walls → UNKNOWN for most early third-party callers.

| @handle / channel | Why | Evidence | Confidence | Watch? |
| --- | --- | --- | --- | --- |
| `@crumbsfamily` | Official Crumbs CT; platform+token announcements; ~12.5K followers; verified badge on public profile | Public profile + announcement tweet `status/2097474961191391550` + crumbs.family + DexScreener socials | High (issuer, not “caller”) | **yes** (seed radar account) |
| `t.me/crumbsfamily` | Official Telegram linked from DexScreener/token info | DexScreener `info.socials` for CA `0x80baa4…9136` | High (official channel) | **yes** (channel monitor; not X handle) |
| `@magaman` | Referenced in crumbsfamily public recent-snippet discourse only | Visible on public `@crumbsfamily` profile soft-view (~2026-09-09); **not** proven as early $CRUMBS caller | Low | **maybe** (needs reply/quote evidence) |
| *Third-party early callers* | Who called before/at launch | Indexed web + soft-walled X replies: **UNKNOWN** this pass | — | **UNKNOWN** — need Nick paste of early engagers or funded X |

**How to grow the list:** Nick pastes handles from early quote/reply graph on the announcement tweet, or Desk adds after public corroboration (article, unlocked public page, non-login visible quote).

- 2026-09-09: Seeded CT Alpha Watchlist from Crumbs (officials only; third-party callers UNKNOWN soft-wall).

## STANDING PROCESS — CT Alpha expansion (Nick, 2026-09-09 ~00:08 ET)
Living loop (not one-shot Crumbs seed):
1. Find tokens on RH Chain **4663** that did really well
2. That had early CT calls at **sub $2M mcap**
3. Identify who called them that early (public evidence only; no scrape / X API until funded)
4. Append `@handles` to CT Alpha Watchlist with evidence + confidence + watch yes/maybe
5. Repeat — ping CoS on meaningful additions
Not buy signals; leads still need DD. Separate from on-chain watched wallets.

Repo playbook overwrite landed: commit `5bd50d4`.

- 2026-09-09: STANDING PROCESS CT Alpha expansion; repo playbook 5bd50d4.

### CT Alpha batch 1 — RH winners → early CT (2026-09-09 ~00:08 ET)
Public articles only; sub-$2M early-call bar hard to prove without X timelines (soft wall). Prefer platform-class / documented early promoters.

| @handle | Token / why | Evidence | Confidence | Watch? |
| --- | --- | --- | --- | --- |
| `@MEADGod` | Pons founder Ozzy — **early-Pons class** (new platform + own token) | KuCoin/Woofun/HTX: Vlad followed @MEADGod ~Jul 21; identified as Pons founder | High | **yes** |
| `@ponsdotfamily` | Official Pons CT — platform announcements | Public tweet cited in Bitcoin Foundation piece (Jul 19 50k launches) | High | **yes** |
| `Ogle` (handle TBD — often cited as WLFI advisor “Ogle”) | Early PONS holder/promoter in first week | KuCoin/HTX: disclosed PONS as major RH holding Jul 18; shared launchpad metrics | Med (display name in press; exact @ UNKNOWN this pass) | **maybe** — confirm @handle |
| `@0xkioto` | RH Chain token trajectory commentary (CASHCAT/AI/PONS) | Lookonchain/BlockBeats cite @0xkioto A9 summary | Med (analyst, not proven sub-$2M first-caller) | **maybe** |
| CASHCAT early CT callers | Sub-$2M calls | Press covers **wallets** not CT handles; Vlad meme tweet Jul 8 is catalyst not a “caller list” | — | **UNKNOWN** — need Nick paste / unlock X |

- 2026-09-09: CT Alpha batch 1 — @MEADGod, @ponsdotfamily yes; Ogle/@0xkioto maybe; CASHCAT callers UNKNOWN.

## Pattern notes — pure meme vs platform-class ($MEME case)
**Case:** $MEME / A Meme Coin on RH Chain **4663** — CA `0x385F4f8ae47651ce5F58F5265395a669f8281e18` (Sep 2026). Stock-paired vs tokenized AMC. Catalyst = public Aron/Tenev feud.

| Axis | Pure news meme ($MEME) | Platform-class (Crumbs / early-Pons / STONK) |
| --- | --- | --- |
| Lead | CT/news feud or wallet sniper; **not** pad firehose | CT traction on **new platform** then own token |
| Attention | Spike from mainstream dispute; dies when feed moves | Sustained if product/users/CT community |
| Narrative | Pun ticker + stock-pair novelty | Product story + team/CT continuity |
| Liq / sellability | Headline mcap ≫ exit capacity; violent mean-reversion | Still risky; better if real usage/fee flywheel |
| Distribution | Early sniper cluster; FOMO late losers | Watch deployer + elite wallets + CT early |
| Score frame | Meme axes only; never utility | Separate meme vs utility; platform token may be hybrid |
| Escalate | Only if lead arrives **pre-viral** (sub ~$2M) with corroboration | Prefer CT/wallet lead → DD → clear |

**Anti-confusion:** On-chain $MEME ≠ Robinhood brokerage listing. Stock-token pair ≠ equity ownership. Do not confuse with other-chain $MEME tickers.

## Clear → proposal → Nick OK → isolated signer
**Nick locked 2026-09-09:** When Desk **clears** a score, path is:
1. **Proposal** — phone-ready for **Grok Bot OR Telegram**: research summary + opportunity / risk / evidence-confidence + **CA** + **size** + **slippage** + **exits** (rich enough to approve from either channel)
2. **Nick approval** in Grok Bot or Telegram (explicit)
3. **Isolated signer** (Desk never holds keys / never signs)

No buys without Nick. **Paper until he says otherwise.** CT/wallet leads remain untrusted alone; pad corroboration only after a lead.

## Position management (future — paper until Nick flips)
**Nick locked 2026-09-09:** After buys exist, position mgmt path includes:
- **Large-move alerts** (TG)
- **Sell buttons** on Telegram
- Desk **proposals/scores may attach** to those position alerts later (context for hold/trim/exit)

Still **paper until Nick flips**. Desk never signs; sell execution goes through Nick OK → isolated signer same as buys.

## Overall rating /10 (TG alerts)
**Nick 2026-09-09:** TG alerts show emoji + overall **/10** at top.

**Hard-reject** → overall `null` (prefer no buy alert) or `0/10 ⛔ REJECT`.

Scores `opp` / `risk` / `evidenceConfidence` on **0–100** (higher risk = worse):
`overall10 = round( (opp/100) * ((100-risk)/100) * (evidenceConfidence/100) * 10 )`

Caps: risk ≥ 80 → max 3; evidenceConfidence < 40 → max 4.
Bands: 8–10 🟢 · 5–7 🟡 · 1–4 🔴 · 0/null ⛔
Header: `{emoji} {overall10}/10 · $SYMBOL · 4663`

## Pattern case — Obscura (privacy / swap-to-earn on RH 4663)
**Nick pointer 2026-09-09:** https://x.com/obscuracex/status/2096349715642126787 (snowflake ≈ 2026-09-05 21:28 UTC — **post** token launch; use as pattern pointer, not early-call proof).

### Provenance timeline
| When (UTC) | Signal | Notes |
| --- | --- | --- |
| ~2026-05-26/27 | Domain `obscuracex.com` registered / site launch detected | **Pre-token** platform signal (months early) — WebsiteLaunches |
| 2026-08-21 ~20:18 | $OBS pair created on RH Uniswap (cited DexScreener/Coinatio) | CA `0xfe242d1Da8FD04f6A1F80B6D3d807B02e062Ad4E` · pair `0xfd7c2011…c956` |
| 2026-08-21 | Press: CryptoCompass “privacy layer entered Robinhood ecosystem” | Cites site + `@ObscuraCEX` + CA |
| 2026-09-05 ~21:28 (2:28 PM display) | @ObscuraCEX: **Agent OBS $AOBS LIVE** — Phase 2 | Official AOBS CA `0x47366e0f257ac009e82bd46fb74e2fb50826ce98` (RH 4663). Two flywheels: $OBS swap-to-earn + $AOBS on-chain agent. **Not** an early $OBS sub-$2M call — product expansion mid-cycle |

### Classification
- **Class:** new-platform / infra (privacy liquidity + swap-to-earn RWA cashback) — closer to **utility/hybrid** scoring than pure meme
- **Chain:** RH **4663** only for this CA. Name collisions exist (Solana dark-pool, mixers, Horizen “Obscura”) — always bind **CA + domain**
- **Lead path:** CT/platform buzz → site/docs DD → then token corroboration. **Not** pad firehose. Not in Desk `:13001` Pons token dump as of 2026-09-09 (different launch path)

### Detection checklist deltas vs Crumbs / early-Pons / STONK
| Check | Crumbs | early-Pons / STONK | **Obscura** |
| --- | --- | --- | --- |
| Pre-token surface | crumbs.robinhood.com easter egg + crumbs.family near token | Pad/product CT before/at platform token | **Domain months earlier (May → Aug token)** |
| Product thesis | Stock-token rewards meme/social | Launchpad / stock-paired pad | **Privacy execution + swap-to-earn RWA** |
| Score framework | Meme (+ platform hybrid) | Platform / pad radar | Prefer **utility** axes (product/usage/token necessity) + separate meme if narrative |
| Factory corroboration | Often via Pons launchAndBuy | Pad is the product | May **not** appear on Pons firehose — don’t wait for pad event |
| Name collision | Hansel CRUMBS vs canonical | Pad ticker spam | High — many “Obscura” projects; CA+site mandatory |
| Live chase? | Pattern only (completed) | Platform radar | **Pattern yes**; live = WATCH after DD, not auto CLEAR |

### Live paper stance (2026-09-09)
Public mcap prints still appear **sub-$2M** in some venues — possible **WATCH** for paper practice after fuller platform DD. **Not** a CLEAR today (incomplete evidenceConfidence on product readiness; Nick tweet ≠ early call). No purchase proposal filed unless Nick asks. No wallets/keys.

## Proposal required market fields (Nick 2026-09-09)
Every paper proposal / TG analysis **must** include:
- **Full CA** (complete `0x…`, never truncated-only)
- **mcap** (USD + source + observedAt)
- **liq** when known (USD + pool/venue + observedAt)

Put in scores and/or top-level `market` object. Missing mcap/liq = incomplete proposal.
