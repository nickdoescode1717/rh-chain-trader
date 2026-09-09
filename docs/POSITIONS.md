# Paper Positions — track, alert, sell-propose (phone + AFK)

**Paper only.** `ENABLE_TRADING` / `ENABLE_TX_SUBMISSION` stay `false` until Nick flips policy. No private keys on research VPS, in git, or in the LLM. **Never auto-sell.** Inline Sell uses the **same approval discipline as buys** → isolated signer handoff stub only. Does **not** touch `walletWatcher`.

Last updated: 2026-09-09

Related: `docs/PURCHASE_PROPOSALS.md` (buy path). This doc is the **exit / open-position** counterpart.

## Implemented valuation behavior

`POST /positions/:id/paper-mark` accepts a finite, non-negative decimal mark (zero represents a total loss). Invalid input returns 400 without changing the prior mark. Entry estimates must be positive finite decimals; invalid estimates remain unknown.

`GET /paper-balance` values ETH-sized positions as cost basis plus available unrealized ETH PnL, including manual marks. Unpriced ETH positions retain cost basis. USD-sized positions are excluded from ETH totals because no exchange rate is available; their ETH PnL stays null. `valuationComplete=false` identifies incomplete valuation. These are paper estimates, not executable quotes. A configured `PAPER_CASH_ETH=0` is respected.

The API tests exercise the in-memory create/approve/mark/balance flow. PostgreSQL persistence, restart recovery, and concurrent decisions are not covered by those tests.

## Purpose

After a paper buy is simulated (or a paper fill is recorded), keep an **open paper position** Nick can monitor overnight:

1. **Track** token CA, size, entry, current price (nullable until oracle), PnL
2. **Alert** on LARGE moves via **Telegram (AFK-critical)** + **Grok when possible** — include current price + short research snapshot
3. **Inline Sell** (full now; partial later) → same approve/reject as buys → `signer_handoff_stub` — never keys on VPS/LLM
4. **Configurable** thresholds (% and/or abs), kill switch, daily loss limits
5. **Paper-first**: simulate positions + alert UX **before** `ENABLE_TRADING=true`
6. **Channel split**: Grok primary in-app; TG critical for AFK alerts + sell buttons

## Hard limits (this slice)

| Rule | Detail |
|------|--------|
| Paper only | Simulate fills, marks, PnL, alerts, sell proposals — no live chain sells |
| No keys | Research path never loads custody; signer is a separate service |
| No live sells | Even on approve → `signer_handoff_stub` only until policy flip |
| No walletWatcher edits | Out of scope; do not modify collector wallet poller |
| No auto-execute | Threshold breach → alert / propose sell — never silent close |

## Tracked fields (open paper position)

| Field | Type / notes |
|-------|----------------|
| `id` | uuid |
| `tokenCA` | RH Chain token contract; `chainId` **must be `4663`** |
| `size` | Paper size text e.g. `eth:0.05` / `tokens:…` (full close only in v1) |
| `entryPrice` | Mark at simulated open (text/numeric); required for PnL |
| `currentPrice` | **Nullable until oracle** — leave null; UI shows "oracle pending" |
| `pnlAbs` / `pnlPct` | Derived when `currentPrice` present; else null |
| `status` | State machine below |
| `thresholds` | Per-position or global % / abs move triggers |
| `openedAt` / `closedAt` | timestamptz |
| `proposalId` | Optional link to originating `purchase_proposals` row |
| `lastAlertAt` | Dedupe / cooldown for LARGE-move alerts |

### Current price / oracle

- Until a trusted mark source exists, `currentPrice` stays **null**.
- Alerts that need a mark either skip or use an explicit **manual/Desk override** (audited) — do not invent prices from untrusted web.
- Stubs for mcap/liq without an oracle are OK (per `AGENTS.md`); do not gold-plate.

## State machine

| State | Meaning |
|-------|---------|
| `simulated_open` | Paper position open; monitoring for LARGE moves |
| `alert_fired` | Threshold breached; AFK/critical alert sent (TG ± Grok) |
| `sell_proposed` | Sell proposal composed (full size v1); awaiting channel delivery |
| `pending_nick` | Awaiting Nick approve/reject (Grok and/or TG buttons) |
| `approved` | Nick approved; next = revalidate + `signer_handoff_stub` only |
| `rejected` | Nick rejected; position may return to `simulated_open` (monitoring continues) |
| `signer_handoff_stub` | Paper handoff recorded; **no sign / no tx** |
| `closed` | Paper closed (simulated fill or Nick dismiss) |
| `disabled` | Legacy Phase-1 stub — never actionable |

```
simulated_open
    → (LARGE move / threshold) alert_fired
         → sell_proposed
              → pending_nick
                   → approved → signer_handoff_stub → closed (paper)
                   → rejected → simulated_open (or closed if Nick dismisses)
    → (manual Inline Sell) sell_proposed → pending_nick → …
    → (kill switch / daily loss) alert_fired + block new risk; optional sell_proposed
```

**Never** transition to live execute from this machine. Live sells require Nick policy flip (`ENABLE_TRADING=true`) + isolated signer (separate work).

## Alerts — LARGE moves (AFK-critical)

### When to fire

Configurable (global defaults + optional per-position override):

| Knob | Example | Notes |
|------|---------|-------|
| `movePct` | e.g. ±25% from entry | % threshold |
| `moveAbs` | e.g. ±0.001 ETH mark | Absolute (same units as mark) |
| `cooldownSeconds` | e.g. 300 | Avoid alert storms |
| `killSwitch` | bool | Stops new paper risk + forces critical notice |
| `dailyLossLimitAbs` / `dailyLossLimitPct` | book-level | Trip → critical alert; no new opens |

Fire when **either** % **or** abs threshold is met (OR), unless config says AND.

### Alert payload (canonical)

Same facts for TG and Grok; TG is **critical path for AFK**.

```json
{
  "type": "position_large_move",
  "positionId": "uuid",
  "tokenCA": "0x…",
  "chainId": 4663,
  "size": "eth:0.05",
  "entryPrice": "0.00012",
  "currentPrice": null,
  "pnlPct": null,
  "pnlAbs": null,
  "trigger": { "kind": "pct", "value": 25, "direction": "up" },
  "researchSnapshot": {
    "symbol": "…",
    "framework": "meme",
    "oneLiner": "Short Desk note / last clear rationale",
    "sources": [{ "kind": "ct", "ref": "https://x.com/…" }]
  },
  "actions": {
    "sellFull": { "path": "/positions/:id/sell", "mode": "full" },
    "dismiss": { "path": "/positions/:id/alerts/:alertId/ack" }
  },
  "channels": {
    "criticalAfk": "telegram",
    "primaryInApp": "grok"
  },
  "paper": true
}
```

- **`currentPrice` + short research snapshot** are required fields in the alert shape (price may be JSON `null` until oracle).
- Untrusted web/X cannot authorize sells; snapshot is informational only.

## Inline Sell (full now; partial later)

1. User taps **Sell** (Grok in-app or TG button) on an open paper position.
2. System creates a **sell proposal** (full size in v1) → `sell_proposed` → `pending_nick`.
3. **Same approval discipline as buys** (`docs/PURCHASE_PROPOSALS.md`):
   - Explicit Nick approve/reject
   - Revalidate checklist before any handoff
   - Response `next: "signer_handoff_stub"` — **DO NOT sign**
4. Partial sells = **later**; do not implement size fractions in this slice.

### Sell proposal sketch (phone-ready)

```json
{
  "id": "uuid",
  "positionId": "uuid",
  "side": "sell",
  "mode": "full",
  "tokenCA": "0x…",
  "chainId": 4663,
  "size": "eth:0.05",
  "entryPrice": "0.00012",
  "currentPrice": null,
  "rationale": "LARGE move alert / Nick inline sell",
  "expiresAt": "2026-09-09T12:00:00.000Z",
  "channels": {
    "primary": "grok_primary",
    "criticalAfk": "telegram"
  },
  "status": "pending_nick",
  "paper": true
}
```

### Revalidate on sell approve (paper)

1. Position still `pending_nick` / not already `closed`
2. `tokenCA` + `chainId=4663` unchanged
3. Not past `expiresAt`
4. Kill switch / daily loss policy still respected
5. `ENABLE_TRADING=false` → stay paper; **do not** call live signer
6. **No keys** on research path

## Channel split

| Channel | Role |
|---------|------|
| **Grok** | Primary **in-app** position view, research, approve/reject when Nick is online |
| **Telegram** | **Critical AFK**: LARGE-move alerts + sell buttons; same JSON facts as Grok |

TG bot build may lag; **document interface + simulate alert UX in paper** first. Until TG exists, Grok still carries in-app path; AFK gap is accepted until Nick opts in a bot token (VPS secret store only).

## Paper-first rollout

1. Schema stub + this doc (this slice)
2. Simulate `simulated_open` rows + fake marks (manual/Desk) → exercise alert UX
3. Wire sell propose → `pending_nick` → approve/reject → `signer_handoff_stub` / `closed`
4. Only after Nick is happy with paper UX: consider `ENABLE_TRADING=true` + real isolated signer (separate approval)

`/orders/*` live routes stay **403**. Paper position endpoints (when added) must never submit txs.

## API sketch (paper — future wire-up)

Base: tunnel `http://127.0.0.1:13001` (prod) or local `:3001`.

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/positions` | List paper positions (include null marks) |
| `POST` | `/positions/simulate` | Open `simulated_open` from proposal/fill stub |
| `POST` | `/positions/:id/sell` | Full sell propose → `pending_nick` |
| `POST` | `/positions/:id/approve` | `approved` → `signer_handoff_stub` (no sign) |
| `POST` | `/positions/:id/reject` | `rejected` |
| `POST` | `/positions/config` | Thresholds, kill switch, daily loss limits |

Exact paths can align with existing Hono style when Coder wires them; this table is the contract intent.

## Isolated signer handoff (stub)

Approve response (mirrors buys):

```json
{
  "data": { "…position / sell proposal…" },
  "next": "signer_handoff_stub",
  "revalidateRequired": true,
  "signed": false,
  "txSubmitted": false,
  "note": "Paper path only. No keys. No tx. Live signer is a separate service."
}
```

## Config defaults (suggested — Nick-tunable)

```json
{
  "movePct": 25,
  "moveAbs": null,
  "thresholdMode": "or",
  "cooldownSeconds": 300,
  "killSwitch": false,
  "dailyLossLimitPct": null,
  "dailyLossLimitAbs": null,
  "sellModeDefault": "full",
  "channels": {
    "primaryInApp": "grok",
    "criticalAfk": "telegram"
  }
}
```

Store runtime config in DB or VPS env — **never** commit secrets. TG bot token only in VPS secret store when enabled.

## Safety checklist

- [ ] Paper simulate + alerts before any `ENABLE_TRADING=true`
- [ ] Never auto-sell on threshold, expire, or channel delivery
- [ ] Same Nick explicit approval as buys
- [ ] No keys on VPS / LLM; signer out of band
- [ ] Do not modify `walletWatcher` in this workstream
- [ ] Untrusted web/X cannot authorize sells

## Out of scope (this doc / thin stub)

- Live sells / tx submission
- Partial sells
- Oracle implementation
- TG bot binary / webhook
- `walletWatcher` changes
- Brokerage (non-chain) positions
