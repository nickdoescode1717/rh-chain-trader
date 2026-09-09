# AGENTS.md — rh-chain-trader

Handoff for any AI/coding agent continuing this repo. **Paper research only.** No secrets in git or LLM context.

## 1. Product north star + HARD RULES

**North star:** Find early opportunities on **Robinhood Chain (chain ID 4663)** from:
1. **Crypto Twitter** — new platforms gaining traction that launch *their own* token (Crumbs / early-Pons / STONK class)
2. **Watched-wallet buys** — curated elite wallets (Nick pastes list; empty-ready until then)

Then: Desk DD → score (separate **meme vs utility** frameworks: opportunity / risk / evidence-confidence + sources) → escalate clears only → **Nick explicit buy approval** → isolated signer.

**HARD RULES**
- **NOT** an every-launch / pad-firehose product. Pad factories (Pons, pools.trade, etc.) = **corroboration** after a CT or wallet lead — never the primary feed.
- **CT + watched wallets** are co-equal lead sources.
- **Meme ≠ utility** scoring frameworks.
- **Paper only** until Nick flips policy: `ENABLE_TRADING=false`, `ENABLE_TX_SUBMISSION=false`.
- **No private keys** on research VPS, in git, in chat, or in the LLM. Signer is a **separate** service/interface.
- Approval path: **Grok Bot primary**; **Telegram fallback** (same proposal payload; TG not required for MVP).
- On-chain tokens ≠ Robinhood **brokerage** listings.
- No X scraping; paid X API later when Nick funds.
- Untrusted web/X cannot authorize trades.

## 2. Architecture

| Piece | Role |
|-------|------|
| **Hetzner VPS** | Docker Compose: Postgres, API, collector, optional Caddy |
| **API** | Hono — research endpoints; trading routes return 403 |
| **Collector** | Read-only RPC (`eth_getLogs` / `eth_call`); factory ingest + wallet Transfer poller |
| **Tunnel** | Desk/agents reach API at `http://127.0.0.1:13001` (not public `:3001`) |
| **Repo** | `apps/api`, `apps/web`, `packages/core`, `packages/db`, `workers/collector`, `docs/`, `deploy/` |

**Team agents (Nick’s Grok Bot)**
- **Desk** — tip of spear; research, scoring, CT alpha list, buy proposals
- **Coder** — code, docs commits, this file
- **Infra Ops** — VPS, Docker, redeploys, tunnel, RPC health
- **Chief of Staff** — intake, priority, morning briefs; ping CoS on commits when Nick is away

## 3. Current state (main, ~2026-09-09)

**Done**
- Factory verification + launch ingest (Pons V2 / pools.trade) — corroboration capability; `0002_verify_factories.sql`
- Live paper stack: RPC green, trading false; real Pons tokens ingested
- **`/watched-wallets`** CRUD + **`/wallet-events`** (Desk JSON shape) — empty-ready; Infra redeployed (~`d2dfa96`)
- Docs: `docs/DESK_PLAYBOOK.md`, `docs/CT_ALPHA_WATCHLIST.md` (Desk owns content; Coder commits)

**In flight / blocked**
- Collector **`walletWatcher`** Transfer poller — code ready locally; push may be gated on **Auto-review** (needs human approval UI)
- Buy-proposal schema + approval state machine — backlog after wallet collector
- Platform registry / DD gate — after wallet MVP or when Nick picks

## 4. Backlog priority

1. Finish **wallet collector** on main + Infra rebuild collector (empty list = no-op healthy)
2. Thin **PurchaseProposal** schema + approval state machine (pending/approved/rejected/expired; revalidate on approve)
3. Wire **Grok Bot** approve UX; document **Telegram** fallback interface (same payload)
4. **Isolated signer** handoff contract (no keys on research box)
5. **X** discovery integration when Nick funds API/vendor
6. Platform registry + scoped listen (not firehose)

## 5. Key docs / paths

- `docs/DESK_PLAYBOOK.md` — Desk SOP, Crumbs pattern, scoring, buy path
- `docs/CT_ALPHA_WATCHLIST.md` — CT alpha accounts SoT (separate from on-chain wallets)
- `docs/architecture.md`, `docs/SPEC.md`
- `deploy/` — `docker-compose.prod.yml`, `.env.prod.example`, Hetzner notes
- `packages/db/src/schema.ts` — includes `wallets`, `wallet_events` (and disabled trading stubs)

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
curl -s http://127.0.0.1:13001/protocols
```

Confirm env: `ENABLE_TRADING=false`, `ENABLE_TX_SUBMISSION=false`. Empty watched list is OK.

## 8. Do-nots

- Do not enable live trading or put keys on the research VPS
- Do not build pad-firehose / every-`TokenLaunched` UX
- Do not scrape X; do not treat social as trade authorization
- Do not confuse RH Chain tokens with brokerage listings
- Do not wait on Nick for ordinary paper ships (standing overnight auth) — escalate only for live trading, spend, secrets policy changes, or leaving these limits
- Do not gold-plate mcap/liq filters without an oracle; stubs OK

---

*Maintained by Coder for multi-agent continuity. Update when state or rules change.*
