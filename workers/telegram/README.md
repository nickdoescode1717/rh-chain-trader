# `@rh/telegram-worker` — paper Telegram AFK worker

Lean Bot API worker (raw `fetch`) for:

1. **Purchase proposals** — Desk-order alerts + Approve / Skip
2. **Post-approve paper fill** receipt (`signer_handoff_stub`)
3. **`/balance` / `/bal`** — Nick buy wallets + paper purse (not watched alphas)
4. **LARGE-move** paper position alerts + Sell (paper propose)

**Paper only.** Never signs. Never loads keys. Never submits txs.

## Alert field order (Desk SoT)

1. HEADER — `$SYMBOL` · chain 4663 · CA (full) · PAPER  
2. THESIS — why now + leadSource (`ct` | `watched_wallet`)  
3. SCORES — opportunity / risk / evidence-confidence  
4. SOURCES — 2–5 bullets  
5. RISKS — honeypot / liq / distribution / legal / narrative-fade  
6. TRADE — size · slippage · exits · route  
7. ASK — Approve (paper) / Skip  

Plain text only — **no `parse_mode`** (avoids Markdown entity bugs on CAs).

## Commands

| Command | Effect |
|---------|--------|
| `/balance` or `/bal` | Paper purse + positions + registered buy wallets (4663). Excludes watched alphas. |

## Secrets (VPS only — never commit)

| Env | Default | Notes |
|-----|---------|-------|
| `TELEGRAM_BOT_TOKEN` | unset | VPS `.env` only |
| `TELEGRAM_CHAT_ID` | unset | Nick’s chat id |
| `TELEGRAM_DRY_RUN` | `true` | Set `false` with token |
| `API_BASE_URL` | `http://api:3001` (compose) | Paper API |
| `POLL_MS` | `15000` | |
| `LARGE_MOVE_PCT` | `25` | |

## Callbacks

| Button | `callback_data` | API |
|--------|-----------------|-----|
| Approve (paper) | `approve:<id>` | `POST .../approve` → then TG sends paper fill receipt |
| Skip | `reject:<id>` | `POST .../reject` |
| Sell | `sell:<positionId>` | paper propose (may 403) |

## Related API

- `GET /paper-balance` — purse + buy wallets stub  
- `GET/POST /buy-wallets` — register Nick buy addresses (no keys)
