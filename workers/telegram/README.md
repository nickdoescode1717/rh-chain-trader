# `@rh/telegram-worker` — paper Telegram AFK worker

Lean Bot API worker (raw `fetch`, no grammy/telegraf) for:

1. **Purchase proposal** approve/reject buttons (Grok primary; TG fallback)
2. **LARGE-move** paper position alerts + **Sell** buttons (paper propose only)

**Paper only.** Never signs. Never loads keys. Never submits txs.  
`ENABLE_TRADING=false` / `ENABLE_TX_SUBMISSION=false` on the research stack.

Approve → API returns `next: "signer_handoff_stub"` only.  
Sell → `POST /positions/:id/sell` with actor `telegram:<userId>` (API may still 403 until positions wired).

Does **not** modify `walletWatcher`. No pad firehose / scrape.

## Secrets (VPS only — never commit)

| Env | Required | Default | Notes |
|-----|----------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | for live poll | unset | Store in VPS secret store only |
| `TELEGRAM_CHAT_ID` | to deliver | unset | Nick’s DM/group chat id |
| `TELEGRAM_DRY_RUN` | — | `true` | Set `false` only with token on VPS |
| `API_BASE_URL` | — | `http://127.0.0.1:13001` | Tunnel to API |
| `POLL_MS` | — | `15000` | Proposal/position poll interval |
| `LARGE_MOVE_PCT` | — | `25` | Alert threshold when marks exist |

If `TELEGRAM_DRY_RUN != false` **or** `TELEGRAM_BOT_TOKEN` is missing → **dry-run** (logs formatted messages; no Bot API).

## How to dry-run

From repo root (pnpm workspace already includes `workers/*`):

```bash
cd workers/telegram
pnpm install   # or from root: pnpm install
pnpm dry-run
# equivalent:
TELEGRAM_DRY_RUN=true API_BASE_URL=http://127.0.0.1:13001 pnpm exec tsx src/index.ts
```

You should see a sample proposal message + keyboard payload and periodic `listProposals` polls. No Telegram network calls.

## Live (VPS — Nick opts in)

```bash
export TELEGRAM_BOT_TOKEN=…   # from BotFather; VPS .env only
export TELEGRAM_CHAT_ID=…
export TELEGRAM_DRY_RUN=false
export API_BASE_URL=http://127.0.0.1:13001
pnpm start   # after pnpm build
```

Callback mapping:

| Button | `callback_data` | API |
|--------|-----------------|-----|
| Approve | `approve:<proposalId>` | `POST /purchase-proposals/:id/approve` `{ actor: "telegram:<userId>" }` |
| Reject | `reject:<proposalId>` | `POST /purchase-proposals/:id/reject` |
| Sell | `sell:<positionId>` | `POST /positions/:id/sell` (paper; may 403) |

## Safety

- No private keys in this worker or its env beyond the bot token
- No tx signing / submission
- Untrusted chat traffic cannot enable live trading
- Keep research `ENABLE_TRADING=false` until Nick flips policy
