# AGENTS.md — rh-chain-trader

Handoff for any AI/coding agent continuing this repo. Current execution is paper only; the target includes policy-controlled automatic buys and preapproved automated sells. No secrets in git or LLM context. **Read `docs/PRODUCT_ALIGNMENT.md` as the current requirements and coverage checklist.**

## 1. Product north star + HARD RULES

**North star:** Find early opportunities on **Robinhood Chain (chain ID 4663)** from:
1. **Crypto Twitter** — new platforms gaining traction that launch *their own* token (Crumbs / early-Pons / STONK class)
2. **Watched-wallet buys** — curated elite wallets (Nick pastes list; empty-ready until then)
3. **Launchpad/protocol research** — existing and newly discovered platforms, official docs/contracts, and public development evidence.

Then: evidence/provenance + market/contract checks → separate meme/utility opportunity, risk and evidence-confidence → report → manual approval or policy-controlled automatic entry → isolated signer → preapproved exit rules. The current code supports only paper manual proposals and a signer stub.

**HARD RULES**
- Launchpad/protocol discovery, X research and curated wallets are all in scope. Prioritize relevant platform launches; never equate a factory event with authorization to buy every token.
- **CT + watched wallets** are co-equal lead sources.
- **Meme ≠ utility** scoring frameworks.
- **Paper only** until Nick flips policy: `ENABLE_TRADING=false`, `ENABLE_TX_SUBMISSION=false`.
- **No private keys** on research VPS, in git, in chat, or in the LLM. Signer is a **separate** service/interface.
- **Telegram is the primary user interface and the ONLY trade-approval channel** (Nick, 2026-09-09): concise research/options, watch controls, proposal decisions and position updates through the existing bot. Grok provides analysis and may draft proposals; it cannot approve/reject trades. Prioritize backend quality and efficiency. The web dashboard is optional administration; do not expand/polish it without a new request.
- On-chain tokens ≠ Robinhood **brokerage** listings.
- **Planned X data provider: TwitterAPI.io**, selected by Nick on 2026-09-09; the owner supplied a key and authorized a US$0.50/day ceiling; see docs/X_BUDGET.md. The older graph scanner targets the official X API; the one-input watch adapter now supports TwitterAPI.io profiles/recent posts, with a live profile lookup validated. Do not treat its credentials as an official X bearer token. Preserve Grok for analysis. No direct X page scraping.
- **Copycat avoidance is critical.** Scores/names/tickers/subdomains/social address matches never verify issuer identity. Require an exact chain/address relationship to authenticated official sources and deployment/deployer evidence before future live eligibility. New paper buys now require the deployed owner-reviewed source and deployment identity gate; unverified or conflicting identities block entry. No project is auto-trusted; X authentication and additional factory adapters remain missing.
- Untrusted web/X cannot authorize trades.

## 2. Architecture

| Piece | Role |
|-------|------|
| **Hetzner VPS** | Docker Compose: Postgres, API, collector, optional Caddy |
| **API** | Hono research + `/discovery/*`, paper proposals and positions; `/orders` 403, paper sell 501 stub |
| **Collector** | Read-only RPC (`eth_getLogs` / `eth_call`); factory ingest + wallet Transfer poller |
| **Tunnel** | Desk/agents reach API at `http://127.0.0.1:13001` (not public `:3001`) |
| **Repo** | `apps/api`, `apps/web`, `packages/core`, `packages/db`, `workers/collector`, `workers/telegram`, `docs/`, `deploy/` |
| **Telegram worker** | Paper AFK: proposal approve/reject + LARGE-move alerts/Sell buttons (`workers/telegram/`; dry-run default) |

**Team agents (Nick’s Grok Bot)**
- **Desk** — tip of spear; research, scoring, CT alpha list, buy proposals
- **Coder** — code, docs commits, this file
- **Infra Ops** — VPS, Docker, redeploys, tunnel, RPC health
- **Chief of Staff** — intake, priority, morning briefs; ping CoS on commits when Nick is away

## 3. Current state (main, ~2026-09-09)

**X budget and caching (2026-09-10)**
- Migration 0012 reserves paid calls under a US$0.50 rolling-24-hour ceiling, with shared daily profile/hourly primary/six-hour related timeline caches and persistent failure backoff. Telegram /usage reports conservative reservations, not provider billing. Key is installed server-side; never print it. See docs/X_BUDGET.md.


**One-input watch intake (deployed 2026-09-10)**
- Application a93f960 deployed; 107 local tests and isolated API/collector database checks passed. Live public discovery found tradedotcv from trade.cv, and 0.88 ETH / 3 holdings were preserved. See docs/deployments/2026-09-10-simple-watch.md.
- See docs/SIMPLE_WATCH.md. Migration 0011, durable /watch account-or-website intake, automatic bounded linked-account/website discovery and Telegram updates. Website-only research works without X. TwitterAPI.io watch enrichment is implemented but remains disabled pending setup; older X graph scanner unchanged.
- Never overwrite existing project mappings or grant identity trust from discovery. Preserve pause and hourly scheduling. Desktop helper scripts/logs are now in C:/Users/ncrim/Desktop/Desktop Files/Bot Operations; repository and SSH paths are unchanged.

**Identity gate (deployed 2026-09-10 UTC)**
- See `docs/IDENTITY_GATE.md`. Migration 0010, API/collector `IDENTITY_GATE_ENABLED`, immutable identity drafts and separate Telegram owner source reviews. Current verification covers explicit website token/chain declarations and direct/Pons V2 canonical deployment evidence, with stale/error/conflict rejection.
- New buys are gated inside durable settlement; scores, names and untrusted draft fields cannot override. Existing holdings/sells remain available. Do not automatically trust any existing project or fabricate source approvals. X authentication and other factory adapters remain missing.
- Application `87e5cb4c0cc8a08855dc8647bd5858dce9fe58ae` deployed with gate enabled on API/collector. 98 local tests, isolated PostgreSQL identity/approval integration and one real-chain Pons creation probe passed. Live read-only checks verified owner auth, unverified proposal buttons and unchanged 0.88 ETH/3 holdings. `tradedotcv` remains paused and untrusted. See `docs/deployments/2026-09-10-identity-gate.md`.

**Durable paper ledger (deployed 2026-09-10 UTC)**
- See `docs/PAPER_LEDGER.md`. Migration 0009 and `PAPER_LEDGER_ENABLED` add atomic, fixed-point paper buy/sell settlement, persistent currency cash and realized P&L, immutable fills, reconciliation, and restart-safe idempotency.
- Telegram `/positions` previews 25/50/100% of remaining tokens; sell confirmations expire after 90 seconds and recheck price/position version. `/history` lists fills. All trade decisions still require the Telegram service credential and exact owner actor.
- Legacy holdings keep known costs and unknown quantities; missing entry snapshots block modeled sells. Never fabricate old entries or reset balances. Do not revert to the old memory-accounting app after ledger fills.
- Fees/slippage are explicitly modeled; gas, token taxes, liquidity impact and actual on-chain fillability are not simulated. No live adapter or automatic exit policy is implemented.
- Application `1ca3f5244e66ac3c7b9c7962fb489bbac5d93146` deployed with ledger enabled. 70 relevant local tests and isolated PostgreSQL concurrency/rollback/restart tests passed. Read-only production verification preserved 3 old holdings, 0.88 ETH cash and 0 realized P&L. No production test fills. See `docs/deployments/2026-09-10-paper-ledger.md`.

**Market pricing and paper entry snapshots (deployed 2026-09-10 UTC)**
- Revision `4fea48846e1e950ab3850dc63132dc95bb5c2572` deployed. `MARKET_PRICING_ENABLED=true` on API/collector. Migration 0008 adds quote cache and durable entry/mark metadata. See `docs/MARKET_PRICING.md` for selection rules and limitations.
- Exact-token Robinhood/native-ETH pools only; no ticker matching or arbitrary `priceNative`→ETH assumption. Fresh quotes verified for CRUMBS and STONKBROKER. Provider receipt time is recorded; underlying trade/price timestamp is unavailable.
- Newly approved paper positions require an eligible quote <=90 seconds old and atomically save the immutable entry snapshot and estimated quantity. Quote observations >180 seconds old or with collection errors produce unavailable P&L. Legacy missing entries remain unknown.
- 84 local tests and isolated PostgreSQL concurrency/rollback/hydration/staleness tests passed. No production test trade. Full budget/exposure ledger and live execution remain unimplemented.

**Telegram portfolio improvements (deployed 2026-09-09)**
- Application revision `3722eae6c2942ad1d8e9df4969cc2bd7cccc9b15` deployed to API and Telegram. Positions use five-item pages, detail/refresh/balance buttons, shortened addresses in summaries and full addresses in details. Research/portfolio navigation edits the current message.
- Token display labels recover through exact chain/address token joins or the original proposal scores after restart. Labels are not issuer verification. Verified CRUMBS, STONKBROKER and PAPERDEMO labels against the deployed database.
- P&L displays recorded manual-mark estimates in the cost currency, with placeholder/missing price states explicitly unavailable. Balance labels incomplete equity and excludes non-ETH holdings from ETH P&L. Receipts omit internal plumbing and alerts no longer offer an unimplemented sell action.
- 43 relevant API/Telegram tests passed; both builds and live read-only portfolio rendering passed. See `docs/deployments/2026-09-09-portfolio.md`.
- Priority remaining: trustworthy entry snapshots, timestamped/current price source and quote currency, durable mark provenance, and accounting/execution reliability. Existing CRUMBS/STONKBROKER entries have no price; do not fabricate historical fills. Live pricing, automatic buys and sells remain absent.

**Telegram interface branch (2026-09-09)**
- Added `/help`, `/projects`, `/watch`, `/research`, `/pause`, `/resume` and inline project controls in the existing bot. A monitoring API updates project and X enablement together without clearing reports or resetting the paid research schedule.
- Automatic research cards notify on the first report and changed rating/coverage/checks, subdomain status, mentioned address set or launch blockers. Timestamp-only/prose-only changes are suppressed; restart deduplication is stored on a Compose volume. Single Telegram worker replica; delivery can duplicate after an uncertain send/crash before state persistence.
- Commands and callbacks require the configured chat and owner. Private chats infer the owner; groups require `TELEGRAM_OWNER_USER_ID`. Polls do not overlap, position data is fetched once per tick, research detail reads are capped at five per minute. Deployed to the existing Hetzner bot on 2026-09-09; see `docs/deployments/2026-09-09-telegram.md` for verified behavior and remaining acceptance gaps.
- Approve/reject APIs require the owner actor plus `TELEGRAM_APPROVAL_TOKEN` (separate service credential shared only by API and Telegram; no collector/Grok access). Configured remotely during coordinated deployment; missing configuration blocks decisions. Live API checks reject unauthenticated and Grok actors. Grok research/drafting remains.

**Prelaunch project research branch (2026-09-09)**
- Migration 0007 registers Nick's `tradedotcv` example. Opt-in public homepage/passive subdomain collector, ten-category evidence rubric, optional xAI Grok narrative, `/research/projects` APIs, Grok research handoff and Project research dashboard are implemented; see `docs/PRELAUNCH_RESEARCH.md`.
- Live public inspection retrieved trade.cv; certificate lookup was unavailable. Initial review is `docs/research/tradedotcv-2026-09-09.md`. No token/deployer identity or legitimacy verified; overall rating withheld for insufficient evidence.
- Original Grok-primary and Telegram-fallback proposal interfaces remain unchanged. This adds no signer or automated entry/exit. Build/lint and 50 unit/API tests passed; DB integration, live X/xAI and browser interaction still require validation.

**X discovery branch (2026-09-09)**
- User now wants X/follow-graph discovery leading toward automatic token-launch buys; account selection and spend/mode parameters were requested and remain pending.
- Added opt-in official X API scanner, persisted post/graph cursors and evidence (migration 0006), `/discovery/*` APIs, and Discovery dashboard. See `docs/X_DISCOVERY.md` for setup and limitations.
- Execution is not implemented by discovery. No live signing, spending, or automatic wallet enrollment. Activation requires configured accounts, X access, explicit purchase policy, and verified execution adapters.

**Codex paper-workflow fixes (2026-09-09 branch)**
- Paper `/positions` routes are wired (the older backlog notes below are stale); live sells remain a 501 stub.
- Proposal amounts require one positive finite ETH/USD amount; malformed JSON shapes, marks, and slippage are rejected.
- Paper equity includes manually marked ETH position values. Unknown marks retain cost basis and report `valuationComplete=false`; USD positions are excluded from ETH totals pending conversion.
- API regression tests: `pnpm --filter @rh/api test` after building workspace packages. Tests use in-memory routes; PostgreSQL persistence/restart behavior needs separate integration verification.

**Done**
- Factory verification + launch ingest (Pons V2 / pools.trade) — corroboration capability; `0002_verify_factories.sql`
- Live paper stack: RPC green, trading false; real Pons tokens ingested
- **`/watched-wallets`** CRUD + **`/wallet-events`** (Desk JSON shape) — empty-ready; Infra redeployed (~`d2dfa96`)
- Docs: `docs/DESK_PLAYBOOK.md`, `docs/CT_ALPHA_WATCHLIST.md`, `docs/PURCHASE_PROPOSALS.md`, `docs/POSITIONS.md`
- **Paper purchase proposals** — `/purchase-proposals` list/create/approve/reject (signer handoff stub only; never signs)
- **Paper Telegram AFK worker** — `workers/telegram/` dry-run default; approve/reject + LARGE-move alert/Sell format (no live sells)

**In flight / blocked**
- Collector **`walletWatcher`** Transfer poller — on main; Infra rebuild as needed (empty list = no-op healthy)
- Paper positions are wired; live execution, automatic entries/exits and integration validation remain incomplete
- Platform registry / DD gate — after wallet MVP or when Nick picks

## 4. Backlog priority

1. Validate X/DB discovery and configure the actual monitored accounts/wallets.
2. Platform/deployer provenance, wallet swap classification, market data and contract checks.
3. Public docs/repos/subdomains + evidence-backed meme/utility scoring and reports.
4. Policy-controlled paper entry/exit, durable limits, accounting and restart/failure validation.
5. Isolated live signer/adapters after the user's spend limits, mode and exit policy are specified.
6. Make the existing Telegram bot the primary interface and sole approval channel; preserve Grok backend analysis and research/draft handoffs.

### Next / tools
- Opt-in live Telegram long-poll on VPS (`TELEGRAM_DRY_RUN=false` + bot token in secret store only); keep paper-only — no live sells

## 5. Key docs / paths

- `docs/PRODUCT_ALIGNMENT.md` — current product scope, full requirements matrix, acceptance gaps and implementation order
- `docs/DESK_PLAYBOOK.md` — historical Desk SOP, Crumbs pattern, scoring, buy path; current alignment checklist supersedes conflicting scope limits
- `docs/CT_ALPHA_WATCHLIST.md` — CT alpha accounts SoT (separate from on-chain wallets)
- `docs/PURCHASE_PROPOSALS.md` — phone-ready paper proposal payload + state machine + TG worker
- `docs/POSITIONS.md` — paper positions / LARGE-move alerts / sell-propose (no live sells)
- `workers/telegram/README.md` — paper AFK TG worker (dry-run default)
- `docs/architecture.md`, `docs/SPEC.md`
- `deploy/` — `docker-compose.prod.yml`, `.env.prod.example`, Hetzner notes
- `packages/db/src/schema.ts` — includes `wallets`, `wallet_events`, paper `purchase_proposals`

## 6. Secrets (names only — never commit)

| Secret | Purpose | When |
|--------|---------|------|
| Alchemy (or backup) RPC URL | Collector / wallet poller | now (rotate if chat-exposed) |
| Postgres password | VPS DB | now |
| Watched-wallet list | Nick paste into API | when ready |
| X API / vendor | CT discovery | soon |
| Isolated signer custody | Live execute only | later |
| Telegram bot token | Fallback approve | optional |

Store only in VPS `.env` / secret store. **Never** git, LLM prompts, or chat paste of live keys.

## 7. How to verify

```bash
# via SSH tunnel to VPS
curl -s http://127.0.0.1:13001/health
curl -s http://127.0.0.1:13001/watched-wallets
curl -s http://127.0.0.1:13001/wallet-events
curl -s http://127.0.0.1:13001/purchase-proposals
curl -s http://127.0.0.1:13001/protocols
```

Confirm env: `ENABLE_TRADING=false`, `ENABLE_TX_SUBMISSION=false`. Empty watched list is OK. Proposals are paper-only (approve → `signer_handoff_stub`). TG worker: `cd workers/telegram && pnpm dry-run`.

## 8. Do-nots

- Do not enable live trading or put keys on the research VPS
- Do not buy every factory launch or substitute raw launch/address matches for project verification
- Do not scrape X; do not treat social as trade authorization
- Do not confuse RH Chain tokens with brokerage listings
- Do not wait on Nick for ordinary paper ships (standing overnight auth) — escalate only for live trading, spend, secrets policy changes, or leaving these limits
- Do not gold-plate mcap/liq filters without an oracle; stubs OK

---

*Maintained by Coder for multi-agent continuity. Update when state or rules change.*



