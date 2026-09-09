# Hetzner always-on setup (Phase 1)

Run Postgres + API + collector 24/7 on a small Hetzner Cloud VPS with Docker Compose.
**No private keys on this box. No trading.**

## 1. Create the server

1. Sign up / log in at [console.hetzner.cloud](https://console.hetzner.cloud).
2. Create a project → **Add Server**.
3. Recommended starter:
   - **Location:** `ash` (US) or `nbg1`/`fsn1` (EU) — pick closest to you / your RPC region
   - **Image:** Ubuntu 24.04
   - **Type:** **CX22** (2 vCPU / 4 GB) is enough for Phase 1; CX32 if you add heavy indexers later
   - **Networking:** IPv4 + IPv6
   - **SSH key:** add yours (disable password auth)
4. Note the public IPv4.

Firewall (Hetzner Cloud Firewall or UFW):

| Port | Source | Why |
|------|--------|-----|
| 22 | your IP only | SSH |
| 80, 443 | anywhere | Caddy / HTTPS |
| 5432 | **deny public** | Postgres stays on localhost/docker network |

## 2. DNS

Point `research.YOURDOMAIN` A record → VPS IPv4 (and AAAA if using IPv6).
Edit `deploy/caddy/Caddyfile` to that hostname.

## 3. Install Docker on the VPS

```bash
ssh root@YOUR_VPS_IP

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y git ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 4. Deploy the app

```bash
# private repo: use a deploy key or fine-grained PAT with Contents read
git clone https://github.com/nickdoescode1717/rh-chain-trader.git /opt/rh-chain-trader
cd /opt/rh-chain-trader

cp deploy/.env.prod.example .env
nano .env   # set strong POSTGRES_PASSWORD, CORS_ORIGIN, RPC_URL

# Edit Caddy host
nano deploy/caddy/Caddyfile

docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
docker compose ps
curl -sS http://127.0.0.1:3001/health
```

HTTPS: after DNS propagates, Caddy should serve `https://research.YOURDOMAIN`.

## 5. RPC

Set `RPC_URL` to an Alchemy / QuickNode / Dwellir Robinhood Chain endpoint (chain ID **4663**).
Public `https://rpc.mainnet.chain.robinhood.com` is rate-limited — fine for smoke tests, not for 24/7 collectors.

## 6. Updates

```bash
cd /opt/rh-chain-trader
git pull
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

## 7. Backups (minimum)

```bash
# example daily dump (add cron)
docker compose exec -T postgres pg_dump -U rh_research rh_chain | gzip > /root/backups/rh_$(date +%F).sql.gz
```

Keep backups off-box (S3/Backblaze) before you care about history.

## 8. What does *not* run here

- Wallet keys / signing service
- Grok agent (alerts → agent in Grok Bot; agent does not need to live on Hetzner)
- X firehose until you add a paid social collector later

## Cost ballpark (2026)

CX22 is typically a few euros/USD per month + traffic. Alchemy free tier may cover early RPC; plan to pay as log volume grows.
