## Overall rating /10 (TG alerts)

**Nick 2026-09-09:** TG alerts show emoji + overall **/10** at top.

**Hard-reject** → overall `null` (prefer no buy alert) or `0/10 ⛔ REJECT`.

Scores `opp` / `risk` / `evidenceConfidence` on **0–100** (higher risk = worse). Values in `(0,1]` are treated as fractions.

```
quality = (opp/100) * ((100-risk)/100) * (evidenceConfidence/100)
overall10 = round(quality * 10)
```

**Caps:** risk ≥ 80 → max 3; evidenceConfidence < 40 → max 4.

**Bands:** 8–10 🟢 · 5–7 🟡 · 1–4 🔴 · 0/null ⛔

**Header:** `{emoji} {overall10}/10 · $SYMBOL · 4663`

Implemented in `workers/telegram/src/format-rating.ts` (HEAD `d67a20f`+).

Also mirrored under Desk playbook section "Overall rating /10 (TG alerts)".
