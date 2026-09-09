# Purchase Proposals — paper approval path (phone-ready)

**Paper only.** `ENABLE_TRADING` / `ENABLE_TX_SUBMISSION` stay `false`. No keys on research box. **Never auto-execute.** Nick must explicitly approve every buy. Isolated signer is out of scope here (interface stub only).

Last updated: 2026-09-09

## Purpose

When Desk **clears** a scored lead (CT or watched-wallet), create a **purchase proposal** rich enough for Nick to approve/reject from **phone** via:

1. **Grok Bot (primary)** — same JSON payload
2. **Telegram (fallback)** — **same JSON payload**; paper AFK worker at `workers/telegram/` (dry-run default)

On approve: **revalidate**, then hand off to an **isolated signer** stub. Until Nick flips live policy, everything remains paper research.

## State machine

| State | Meaning |
|-------|---------|
| `draft` | Desk composing (optional pre-persist; not required by API) |
| `pending_nick` | Awaiting Nick approve/reject (create lands here) |
| `approved` | Nick approved; revalidate + signer handoff stub only — **no sign/submit** |
| `rejected` | Nick rejected |
| `expired` | Past `expiresAt` without decision |
| `cancelled` | Desk/system cancelled |
| `disabled` | Legacy Phase-1 stub default — never treat as actionable |

**Never** transition to live execute from this machine. Live path requires Nick policy flip + isolated signer (separate work).

```
Desk clear → create pending_nick
           → Nick approve (Grok primary | TG fallback, same JSON)
                → revalidate checklist
                → next: signer_handoff_stub (out of scope; no keys / no tx)
                → paper until ENABLE_TRADING flipped by Nick
           → Nick reject → rejected
           → timeout → expired
           → cancel → cancelled
```

## Phone-ready payload (canonical JSON)

Same shape for Grok primary and Telegram fallback.

```json
{
  "id": "uuid",
  "tokenCA": "0x…",
  "chainId": 4663,
  "sizeEth": "0.05",
  "sizeUsd": null,
  "slippageBps": 100,
  "exits": {
    "tpPct": 60,
    "slPct": 35,
    "trailPct": null,
    "maxHoldSeconds": 1800
  },
  "scores": {
    "opportunity": 72,
    "risk": 48,
    "evidenceConfidence": 0.65,
    "framework": "meme"
  },
  "sources": [
    { "kind": "ct", "ref": "https://x.com/…", "note": "…" },
    { "kind": "onchain", "ref": "0x…tx", "note": "Blockscout" }
  ],
  "leadSource": "ct",
  "rationale": "Clear: …",
  "expiresAt": "2026-09-09T12:00:00.000Z",
  "channels": {
    "primary": "grok_primary",
    "fallback": "telegram_fallback"
  },
  "status": "pending_nick"
}
```

### Field notes

| Field | Rule |
|-------|------|
| `tokenCA` | RH Chain token contract (checksum or lower); required |
| `chainId` | **Must be `4663`** |
| `sizeEth` **or** `sizeUsd` | Exactly one preferred; API stores as text `eth:…` / `usd:…` |
| `slippageBps` | Integer bps (e.g. 100 = 1%) |
| `exits` | `tp` / `sl` / `trail` / `time` (names flexible in JSON; store as jsonb) |
| `scores.framework` | `meme` \| `utility` (separate frameworks — never conflate) |
| `leadSource` | `ct` \| `watched_wallet` |
| `channels` | Documented routing: Grok primary, TG fallback — **same JSON** |
| `expiresAt` | ISO timestamptz; past → treat as `expired` |

## API (paper)

Base: tunnel `http://127.0.0.1:13001` (prod) or local `:3001`.

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/purchase-proposals` | List proposals |
| `POST` | `/purchase-proposals` | Create → `pending_nick` (paper always allowed; **never** submits txs) |
| `POST` | `/purchase-proposals/:id/approve` | Set `approved` + `audit_log`; return `{ next: "signer_handoff_stub", revalidateRequired: true }` — **DO NOT sign** |
| `POST` | `/purchase-proposals/:id/reject` | Set `rejected` + audit |

`/orders/*` and `/positions/*` remain **403**.

## Revalidate checklist (on approve)

Before any future signer handoff (still stub), Desk/API consumers must re-check:

1. **CA still correct** — same `tokenCA` on chain `4663`; no ticker-collision swap
2. **Not expired** — `expiresAt` in the future
3. **Scores still clear** — opportunity / risk / evidence-confidence still above Desk clear bar; framework (`meme`\|`utility`) unchanged
4. **Sources intact** — lead (`ct`\|`watched_wallet`) + corroboration still valid; no hard-reject flags (honeypot, zero liq, fictional seed)
5. **Size / slippage / exits** — still within Nick risk prefs; paper sizing only
6. **Policy** — `ENABLE_TRADING=false` → stay paper; **do not** call live signer even if stub exists
7. **No keys** — research path never loads private keys or submits txs

If any check fails → do **not** hand off; leave proposal for Nick/Desk to cancel or re-propose.

## Telegram fallback — paper AFK worker

**Implemented:** lean worker at `workers/telegram/` (`@rh/telegram-worker`).

- **Same JSON body** as Grok approve/reject.
- Bot posts proposal summary + inline **Approve / Reject** → `POST /purchase-proposals/:id/approve|reject` with actor `telegram:<userId>`.
- Default `TELEGRAM_DRY_RUN=true` (or no token) → logs only; no Bot API.
- Store `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` **only** in VPS secret store when Nick opts in — never commit.
- Approve still returns `signer_handoff_stub` only — **no sign / no tx**.
- See `workers/telegram/README.md`. **Grok Bot remains primary** for in-app approvals.

## Isolated signer handoff (stub)

Approve response:

```json
{
  "data": { "…proposal…" },
  "next": "signer_handoff_stub",
  "revalidateRequired": true,
  "signed": false,
  "txSubmitted": false,
  "note": "Paper path only. No keys. No tx. Live signer is a separate service."
}
```

Research VPS / Desk / API **must not** implement signing here.

## Safety

- Paper proposals allowed even while `ENABLE_TRADING=false`
- Never auto-execute on approve, expire, or channel delivery
- Untrusted web/X cannot authorize trades
- Do not modify walletWatcher in this workstream; TG worker is paper-only


## Isolated signer handoff (expanded)

Canonical design: **`docs/ISOLATED_SIGNER.md`** + **`docs/BUY_WALLETS.md`**.

Approve response now includes `signerHandoff` (paper stub):

- `keyModel`: `single_controlling_key_multi_address`
- `buyAddress` / `buyAddressCandidates` from `/buy-wallets` registry (public addresses only)
- `signed: false`, `txSubmitted: false`, `enableTrading: false`
- Create/approve reject any `privateKey` / `key` / `mnemonic` / `seed` fields

Research API never calls a live signer. Empty buy-wallet registry → `buyAddress: null` (OK for paper).
