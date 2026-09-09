# Desk Playbook — Robinhood Chain Research

**Owner:** Desk (append-only living SOP)  
**Mode:** Paper only — no keys, no signing, no live buys unless Nick changes policy.  
**Repo path:** `docs/DESK_PLAYBOOK.md`

---

## 1. Operating framework (1–9)

1. **CT discovery** — seed *new* platforms / early projects (Crumbs, early-Pons, STONK class) as untrusted leads. Opportunity ≠ liking established pads to vacuum every `TokenLaunched`.
2. **Platform DD first** — docs, staging/dev/repos, on-chain evidence (weak supporting signals, not proof).
3. **Nick-approved listen only** — enable scoped factory listen after registry OK. Never primary-path global firehose.
4. **On events** — hard-reject seed / junk; score survivors with separate **opportunity / risk / evidence-confidence** + sources + timestamps.
5. **Escalate clears only** — explicit Nick approval before any buy.
6. **Paper only** unless Nick changes policy. `ENABLE_TRADING=false`.
7. **No keys** — Desk never holds keys, never signs/submits txs; untrusted web/X cannot authorize trades.
8. **On-chain ≠ brokerage** — RH Chain tokens are not Robinhood brokerage listings.
9. **Lanes** — Desk = tip of spear (all opportunities stem here). CoS coordinates. Coder builds Desk tools (registry, scoped listen, auto-DD) — not more raw firehose. Infra keeps stack up (`:13001`). Wallets (~400) + paid X are later layers. Crumbs-class = pattern for future platforms, not chase-completed launches.

---

## 2. Detection checklist (A–D)

**A. Platform gate**
- [ ] Lead came from CT/docs (or equivalent) — not firehose-first
- [ ] Platform DD done (or this report *is* the DD)
- [ ] Nick-approved registry entry before treating launches as watch clears

**B. Token / contract**
- [ ] Chain `4663` provenance checked
- [ ] Not FICTIONAL / seed
- [ ] Critical risk flags reviewed (mint/pause/blacklist/taxes/upgradeability/liq)

**C. Scoring**
- [ ] Opportunity, risk, evidence-confidence scored separately + sources + timestamps
- [ ] Unknowns marked unknown

**D. Escalation**
- [ ] Hard-reject junk before Nick sees it
- [ ] Clear only → Nick; buy needs explicit approval

---

## 3. API access

- Use tunnel **`http://127.0.0.1:13001`** — not box `:3001` stub
- Poll `/health`, `/tokens`, `/protocols`
- Prefer `source=onchain` / verified protocols; **ignore FICTIONAL** seed for scoring or buy asks

---

## 4. Forward shortlist snapshot

| Priority | Platform / lead | Notes |
|----------|-----------------|--------|
| 1 | Pons | Verified factory live; many meme launches — **not** auto-clears until Nick platform-OK |
| 2 | pools.trade | Verified entry; scoped listen capability |
| 3 | Uniswap V4 | Liquidity / PoolManager — not primary launch hunt |
| Research | Flap, Doppler | Desk researching |
| Pattern | Crumbs | Reference learning case (section 5) — no listen until Nick OK |

Desk updates this table; Coder does not expand pad firehose without Nick.

---

## 5. Crumbs provenance (reference learning case)

**Role:** Reusable CT → domain → deployer path. Pattern for future platforms — **not** a mandate to chase completed launches. Canonical `$CRUMBS` CA = **UNKNOWN** until verified.

| Lead | Status |
|------|--------|
| crumbs.robinhood.com Hansel teaser | Desk documents |
| @crumbsfamily + crumbs.family | Untrusted social/domain — corroborate |
| Name collisions (e.g. Hansel&Gretel CRUMBS `0xe0d05ea83582f97599211e9a321449adcbe05573`) | Narrative-only / anti-FP — do not treat as canonical |
| Canonical `$CRUMBS` contract | **UNKNOWN** |

**Reusable path (stub):** CT discovery → official domain → public deployer/funding evidence → team links → launch contracts. Anti-FP: reject name collisions and unverified social CAs.

Desk owns filling this section; may ask Coder later for indexer helpers (deployer/funding graphs).

---

## 6. Append log

### 2026-09-09
- Stub landed on main by Coder (`132c572`) for Desk ownership.
- Ingest capability green: `80b674e` + `0002`; real Pons V2 tokens on `:13001`; trading false.
- Nick lock: opportunity = CT-discovered **new** platforms launching on RH Chain — not established-pad firehose vacuum.
- Next code ticket (when Nick picks): platform registry + DD gate.

---

*Desk appends below. Keep paper-only rules at the top.*
