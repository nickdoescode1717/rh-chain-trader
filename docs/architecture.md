# Architecture — Robinhood Chain Research Agent (Phase 1)

This is a historical Phase 1 overview. For the complete current product target and actual coverage, read [PRODUCT_ALIGNMENT.md](PRODUCT_ALIGNMENT.md). Paper proposals/positions and X discovery now exist; automated research, live entry and exits remain incomplete. Historical verification/deployment claims below are not current test results.

## Goal

Phase 1 is a **research dashboard MVP** for Robinhood Chain (chain ID **4663**).

It indexes protocols/tokens, stores evidence, computes opportunity / risk / evidence_confidence scores, and exposes a read-oriented API + web UI.

**Out of scope (hard):** live trading, wallet signing, private keys, transaction submission.

## System context

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Web (Vite) │────▶│  API (Hono) │────▶│  Postgres    │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    ┌──────▼──────┐
                    │  @rh/core   │  scoring + risk heuristics
                    └─────────────┘

┌──────────────────┐     optional read-only
│ Collector worker │────▶ RPC / Blockscout
└──────────────────┘     (no-ops without RPC_URL)
```

## Packages

| Path | Role |
|------|------|
| `packages/core` | Shared types, meme/utility/hybrid scoring, risk flags |
| `packages/db` | Drizzle schema, SQL migrations, FICTIONAL seed |
| `apps/api` | REST: `/health`, `/tokens`, `/watchlist`, `/protocols` |
| `apps/web` | React dashboard pages for tokens, detail, watchlist, protocols |
| `workers/collector` | Real eth_getLogs launch ingest (Pons V2 + pools.trade); idle without `RPC_URL` |

## Chain & explorers

- Chain ID: `4663`
- Blockscout: `https://robinhoodchain.blockscout.com`
- Protocol factories verified on chain 4663 via migration `0002_verify_factories.sql` + collector upserts.

## Scoring

Inputs include liquidity, momentum, holder concentration, contract verification/proxy, age, narrative, utility signals, and evidence items.

Outputs:

- `opportunity` (0–100)
- `risk` (0–100)
- `evidence_confidence` (0–1)
- Framework: `meme` | `utility` | `hybrid`

## Data model

Tables: `protocols`, `contracts`, `tokens`, `evidence`, `wallets`, `wallet_events`, `scores`, `reports`, `audit_log`.

Stubbed / disabled: `purchase_proposals`, `orders`, `positions` (status `disabled`, app returns 403 on trading routes).

## Safety rails

- Env flags `ENABLE_TRADING` / `ENABLE_TX_SUBMISSION` are ignored; API refuses order/position/proposal routes.
- Collector never signs; RPC usage is read-only when configured.
- Demo seed is labeled **FICTIONAL**.
- API falls back to in-memory FICTIONAL data if Postgres is down (local DX).

## Future phases (not implemented)

- Deeper pool / liquidity indexing beyond launch events
- Evidence pipeline from Blockscout APIs (beyond tx links)
- Human-in-the-loop research reports only (still no autonomous trading unless explicitly redesigned)
