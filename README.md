# RH Chain Trader — Phase 1 Research MVP

Research dashboard for **Robinhood Chain** (chain ID **4663**).

> **Research only.** No live trading, signing, private keys, or transaction submission in production paths.

Blockscout: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

## Monorepo layout

```
rh-chain-trader/
├── apps/
│   ├── api/          # Hono API (health, tokens, watchlist, protocols)
│   └── web/          # Vite + React dashboard
├── packages/
│   ├── core/         # Types, scoring (meme/utility), risk heuristics
│   └── db/           # Drizzle ORM schema + SQL migrations + FICTIONAL seed
├── workers/
│   └── collector/    # RPC / log listener stubs (no-op without RPC_URL)
├── docs/architecture.md
├── docker-compose.yml
└── .env.example
```

## Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io) ≥ 9 (`corepack enable`)
- Docker (for Compose stack)

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit POSTGRES_PASSWORD if desired — never commit .env

docker compose up --build
```

Services:

| Service | URL / port |
|---------|------------|
| Postgres | `localhost:5432` |
| API | http://localhost:3001 |
| Collector | background worker |

On first boot, Postgres runs `packages/db/drizzle/0000_init.sql` then **FICTIONAL** seed `0001_seed_fictional.sql`.

API health: `curl http://localhost:3001/health`

Run the web UI locally against Compose API:

```bash
pnpm install
pnpm --filter @rh/web dev
# http://localhost:5173  (VITE_API_BASE_URL=http://localhost:3001)
```

## Local development (without Docker API)

```bash
cp .env.example .env
pnpm install

# Optional: start only Postgres
docker compose up -d postgres

pnpm db:migrate          # applies SQL migrations
pnpm --filter @rh/db seed   # optional TS seed (FICTIONAL)

pnpm --filter @rh/core build
pnpm --filter @rh/db build

pnpm --filter @rh/api dev      # :3001 — falls back to in-memory FICTIONAL data if DB down
pnpm --filter @rh/web dev      # :5173
pnpm --filter @rh/collector dev
```

Or from root: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm db:migrate`, `pnpm dev`.

## Required environment variables

See `.env.example`. Key vars:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `POSTGRES_USER` / `PASSWORD` / `DB` | Compose Postgres |
| `API_PORT` | Default `3001` |
| `CORS_ORIGIN` | Default `http://localhost:5173` |
| `CHAIN_ID` | `4663` |
| `BLOCKSCOUT_BASE_URL` | Explorer base |
| `RPC_URL` | Optional; collector no-ops when empty |
| `VITE_API_BASE_URL` | Web → API |
| `ENABLE_TRADING` | Must stay `false` |
| `ENABLE_TX_SUBMISSION` | Must stay `false` |

**No secrets belong in the repo.** Copy `.env.example` → `.env` locally.

## API endpoints

- `GET /health`
- `GET /tokens`, `GET /tokens/:id`
- `GET /watchlist`, `POST|DELETE /watchlist/:id`
- `GET /protocols`, `GET /protocols/:slug`
- Trading-shaped routes (`/orders/*`, `/positions/*`, `/purchase-proposals/*`) → **403**

## Scoring

`@rh/core` scores tokens with **opportunity**, **risk**, and **evidence_confidence** under meme vs utility (or hybrid) frameworks. Tests:

```bash
pnpm --filter @rh/core test
```

## Protocol seeds

Uniswap, Pools.trade, Pons — `factory_address` is `null` with **NEEDS_ONCHAIN_VERIFICATION** comments until confirmed on chain 4663.

## Sample data

Docker init and in-memory fallback load **FICTIONAL** tokens/evidence clearly labeled as such. Do not treat as market data.

## License

Private / internal research tooling. Not investment advice.

## Always-on (Hetzner)

Phase 1 collectors should run 24/7 on a small VPS (not serverless).

See **[deploy/hetzner-setup.md](deploy/hetzner-setup.md)** for:
- CX22 (or similar) sizing
- firewall / DNS / Docker install
- `deploy/docker-compose.prod.yml` + Caddy TLS
- RPC notes (Alchemy etc.)

Quick start on the server:

```bash
cp deploy/.env.prod.example .env
# edit .env + deploy/caddy/Caddyfile
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```
