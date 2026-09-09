# Buy wallets & isolated signer (Nick architecture)

**Locked 2026-09-09.**

## Model

- **ONE private key** controls **all** of Nick’s buy wallets (single controlling key → multi-address account model).
- Research stack (API / collector / Telegram / LLM / chat) never holds that key.
- VPS registry stores **public addresses only** (`GET/POST /buy-wallets`).
- `/paper-balance` and TG `/balance` sum **paper purse + open paper positions + read-only RH Chain 4663 balances** for registered buy addresses — **not** watched alphas.

## Hard limits

- Paper until Nick flips `ENABLE_TRADING`.
- Key lives only in a future **isolated signer** service (separate from research VPS).
- Never put the key in git, VPS `.env` for API/TG, LLM context, or chat.
- Never ask Nick to paste the key into Grok Bot / Telegram / tickets.

## Flow (future live)

1. Desk clear → purchase proposal (addresses + size; no key)
2. Nick approves (Grok or TG)
3. Revalidate → hand off to **isolated signer** (one key, pick buy address)
4. Signer returns receipt; research stack records paper/live status

Details: **`docs/ISOLATED_SIGNER.md`** (handoff payload stub on Approve).

## Current stubs

| Surface | Behavior |
|---------|----------|
| `POST /buy-wallets` | Register address + label (`buy`\|`funding`); rejects `key`/`privateKey` |
| `GET /buy-wallets` | List registered addresses (`keyModel` noted) |
| `GET /paper-balance` | Paper cash + positions + buy wallets (`nativeEth` rpc_pending until RPC wired) |
| TG `/balance` | Formats paper-balance; excludes watched wallets |
| Approve response `signerHandoff` | Paper stub: candidates + optional buyAddress; never signs |

Watched-wallet list (`/watched-wallets`) remains a separate alpha radar — never Nick’s buy purse.

## Registering addresses

When Nick is ready, paste **public** buy addresses only:

```bash
curl -X POST http://127.0.0.1:13001/buy-wallets \
  -H 'Content-Type: application/json' \
  -d '{"address":"0x…","label":"main","kind":"buy"}'
```

No key fields. Empty registry is OK — handoff stub returns `buyAddress: null`.
