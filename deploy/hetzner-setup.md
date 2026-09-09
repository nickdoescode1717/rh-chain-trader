# Hetzner always-on setup (Phase 1)

Run Postgres + API + collector 24/7 on a small Hetzner Cloud VPS with Docker Compose.
**No private keys on this box. No trading.**

Nick’s box: **CPX12** (2 GB) in `hel1` — enable ~2G swap before heavy Docker builds.

## 1. Create the server

1. Sign up / log in at [console.hetzner.cloud](https://console.hetzner.cloud).
2. Create a project → **Add Server**.
3. Starter options:
   - **Location:** e.g. `hel1` / `nbg1` / `fsn1` / `ash`
   - **Image:** Ubuntu 24.04+ (cloud image OK)
   - **Type:** **CPX12** for paper/MVP (add swap); prefer **CX22/CPX22** (4 GB) when collectors get busy
   - **SSH key:** Infra Ops deploy key
4. Note the public IPv4.

Firewall (Hetzner Cloud Firewall or UFW):

| Port | Source | Why |
|------|--------|-----|
| 22 | your IP only | SSH |
| 80, 443 | anywhere | Caddy / HTTPS |
| 5432 | **deny public** | Postgres stays on localhost/docker network |

## 2. DNS

Point `research.YOURDOMAIN` A record → VPS IPv4 (and AAAA if using IPv6).
Edit `deploy/caddy/Caddyfile` to that hostname. Until DNS exists, hit the API on `127.0.0.1:3001` over SSH.

## 3. Install Docker on the VPS

```bash
ssh root@YOUR_VPS_IP

apt update && apt upgrade -y
# 2G swap (important on CPX12)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

curl -fsSL https://get.docker.com | sh
apt install -y git ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 4. Deploy the app

```bash
git clone https://github.com/nickdoescode1717/rh-chain-trader.git /opt/rh-chain-trader
cd /opt/rh-chain-trader

cp deploy/.env.prod.example .env
nano .env   # strong POSTGRES_PASSWORD; set RPC_URL; CORS_ORIGIN

# Optional until you have a domain — Caddy can wait
nano deploy/caddy/Caddyfile

docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
docker compose -f deploy/docker-compose.prod.yml ps
curl -sS http://127.0.0.1:3001/health
```

## 5. RPC

Set `RPC_URL` to Alchemy / QuickNode / Dwellir for Robinhood Chain (**4663**).
Example Alchemy shape: `https://robinhood-mainnet.g.alchemy.com/v2/YOUR_KEY`
Public `https://rpc.mainnet.chain.robinhood.com` is rate-limited — smoke only.

## 6. Updates

```bash
cd /opt/rh-chain-trader
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

## 7. Backups (minimum)

```bash
mkdir -p /root/backups
docker compose -f deploy/docker-compose.prod.yml exec -T postgres pg_dump -U rh_research rh_chain | gzip > /root/backups/rh_$(date +%F).sql.gz
```

## 8. What does *not* run here

- Wallet keys / signing
- Live trading (`ENABLE_TRADING=false`)
- Grok agents (Desk/Coder stay in Grok Bot)
- X firehose until a paid social collector is added
