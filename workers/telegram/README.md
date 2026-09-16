# `@rh/telegram-worker` — paper Telegram AFK worker

Lean Bot API worker (raw `fetch`) for:

1. **Purchase proposals** — Desk-order alerts + Approve / Skip
2. **Post-approve paper fill** receipt (`signer_handoff_stub`)
3. **`/balance` / `/bal`** — Nick buy wallets + paper purse (not watched alphas)
4. **LARGE-move** paper position alerts + Sell (paper propose)
5. **Project research** — watchlists, reports and Pause/Resume buttons; selective new/changed research alerts

**This is the primary user interface and the only trade-approval channel.** The existing bot and backend are sufficient; the web dashboard is optional administration. Grok remains a backend analyst and may draft proposals, but cannot approve or reject them. TwitterAPI.io is the planned X provider, with setup deferred.

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
| `/positions` or `/pos` | Existing paper positions. |
| `/start` or `/help` | Compact command menu and Projects button. |
| `/projects` | Paginated list, six projects per page, with report buttons. |
| `/watch @handle domain [utility\|meme\|unknown]` | Register a project and enable its project/X monitoring. Example: `/watch @tradedotcv trade.cv utility`. Repeating an unchanged watch preserves its report/schedule; conflicting identity details require backend review. |
| `/research @handle` | Latest stored report: coverage/rating, known checks, public subdomain findings, unverified addresses, launch blockers, Grok summary and source links. Refresh reads the stored report; it does not trigger a paid scan. |
| `/pause @handle` / `/resume @handle` | Disable/enable both project research and its X account. Retains the last report and schedule; an in-flight scan may finish. Does not change purchase policy. |

Research cards have Refresh report, Pause/Resume watching and Projects buttons. Project pages are navigated entirely in Telegram. The existing Approve/Skip paper-proposal buttons and balance/position flows remain available. Sell remains the existing unimplemented API path, not a working automated exit.

## Efficient report delivery

In live bot mode, research polling reads the project index at most once per minute and fetches up to five changed snapshots per pass with round-robin fairness. It sends the first report and subsequent changes to rating/coverage/check status, discovered service status, mentioned address sets or launch blockers. Timestamps and rewritten Grok prose alone do not generate alerts. This is not broad chatter/mention alerting, a launch-time SLA or a real-time sniping trigger. Reports with collection errors or paused monitoring are skipped by automatic delivery; `/research` still shows their last stored state.

Successful research deliveries and unchanged-snapshot checks persist in `TG_RESEARCH_STATE_PATH`. Compose mounts `/data/research-alerts.json` on the `telegram_state` volume, so ordinary container recreation does not repeat unchanged reports. Failed sends are retried. A crash after Telegram accepts a message but before state is saved can duplicate it; this is not exactly-once delivery. Run one Telegram worker replica. Corrupt/unreadable state disables automatic research alerts until repaired/restarted; interactive commands remain available. Dry-run mode sends no Telegram messages and does not mark research reports delivered.

Polling runs sequentially after each completed pass and shares one positions read between fill receipts and move alerts. API/Telegram requests have timeouts. Message previews are disabled to keep cards compact. These changes do not add paid provider requests on button presses.

## Secrets (VPS only — never commit)

| Env | Default | Notes |
|-----|---------|-------|
| `TELEGRAM_BOT_TOKEN` | unset | VPS `.env` only |
| `TELEGRAM_APPROVAL_TOKEN` | unset | Separate random service secret, at least 32 characters, shared only with the API. Required for Approve/Skip. Never place it in Grok/collector/browser environment or a proposal payload. |
| `TELEGRAM_CHAT_ID` | unset | Nick’s chat id |
| `TELEGRAM_OWNER_USER_ID` | inferred for private chat | Only this user can issue commands or click action buttons. Required for a group chat; chat membership alone does not authorize a user. |
| `TELEGRAM_DRY_RUN` | `true` | Set `false` with token |
| `API_BASE_URL` | `http://api:3001` (compose) | Paper API |
| `POLL_MS` | `15000` | |
| `LARGE_MOVE_PCT` | `25` | |
| `TG_RESEARCH_STATE_PATH` | `/tmp/rh-tg-research-sent.json` standalone; `/data/research-alerts.json` Compose | Persistent research notification state; use a durable writable path outside source control. |

All incoming commands and callbacks require the configured chat and owner, including existing paper approvals. No bot token or chat configuration was changed by this feature. Deploy the API and bot together after migration 0007 from the preceding research PR. Keep the configured Telegram profile/environment for your current VPS bot; no new bot is needed. Actual deployment and live Telegram delivery have not been verified by local tests.

During that deployment, set the same new random `TELEGRAM_APPROVAL_TOKEN` on the API and bot, and expose the configured chat/owner IDs to the API as wired in Compose. No secret was generated or configured by this PR. Until configured, approval/skip requests fail closed; this intentionally removes the old unauthenticated Grok decision path. Research commands still work. A forged `actor: telegram:<id>` alone cannot authorize a decision.

Copycat avoidance remains a hard execution requirement. Research cards and paper proposal cards explicitly say identity is unverified. Grok-supplied identity flags or high scores do not change that. Live identity/provenance verification is still unimplemented; do not interpret the new label or owner authentication as completed copycat detection.

Run `pnpm --filter @rh/telegram-worker test` for mocked command routing, authorization, message bounds, notification filtering/retries and file persistence tests. Provider behavior follows the [Telegram Bot API](https://core.telegram.org/bots/api); tests do not contact Telegram.

## Callbacks

| Button | `callback_data` | API |
|--------|-----------------|-----|
| Approve (paper) | `approve:<id>` | `POST .../approve` → then TG sends paper fill receipt |
| Skip | `reject:<id>` | `POST .../reject` |
| Sell | `sell:<positionId>` | paper propose (may 403) |

## Related API

- `GET /paper-balance` — purse + buy wallets stub  
- `GET/POST /buy-wallets` — register Nick buy addresses (no keys)
