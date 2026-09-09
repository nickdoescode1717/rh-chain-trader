/**
 * Desk-depth helpers for Telegram paper alerts (plain text, no parse_mode).
 */

import type { Proposal } from "./api.js";

export const TG_MAX = 3900;

export function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

export function str(v: unknown, fallback = "-"): string {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

export function num(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : str(v);
}

/**
 * Normalize score to 0-100.
 * Accepts 0-100 ints OR 0-1 fractions (common in sample payloads).
 * If 0 < n <= 1, treat as fraction → n*100 (so 0.72 → 72).
 */
export function toHundred(v: unknown, _asFractionHint = false): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1) return n * 100;
  return n;
}

export function scoreDisplay(v: unknown, asConfidence = false): string {
  const n = toHundred(v, asConfidence);
  if (n == null) return "-";
  return `${Math.round(n)}/100`;
}

export function scoreWhy(scores: Record<string, unknown> | null, key: string): string {
  if (!scores) return "";
  const why =
    scores[`${key}Why`] ??
    scores[`${key}_why`] ??
    scores[`${key}Note`];
  return why ? ` — ${str(why).slice(0, 80)}` : "";
}

export function leadLabel(lead: string | null | undefined): string {
  if (lead === "ct") return "ct (Crypto Twitter)";
  if (lead === "watched_wallet") return "watched_wallet";
  return lead ? String(lead) : "-";
}

export function leadExtra(p: Proposal, scores: Record<string, unknown> | null): string {
  const handle =
    scores?.ctHandle ??
    scores?.handle ??
    (p as { walletLabel?: unknown }).walletLabel ??
    scores?.walletLabel;
  if (handle) return str(handle);
  if (Array.isArray(p.sources)) {
    for (const s of p.sources) {
      const r = asRecord(s);
      if (!r) continue;
      const h = r.handle ?? r.ref;
      if (h) return str(h);
    }
  }
  return "";
}

export function sizeLine(p: Proposal): string {
  if (p.sizeEth != null && p.sizeEth !== "") return `${p.sizeEth} ETH (paper)`;
  if (p.sizeUsd != null && p.sizeUsd !== "") return `$${p.sizeUsd} (paper)`;
  if (typeof p.size === "string" && p.size) return `${p.size} (paper)`;
  return "-";
}

export function exitsLine(p: Proposal): string {
  const e = asRecord(p.exits);
  if (!e) return "-";
  const bits = [
    e.tpPct != null ? `TP ${e.tpPct}%` : null,
    e.slPct != null ? `SL ${e.slPct}%` : null,
    e.trailPct != null ? `trail ${e.trailPct}%` : null,
    e.maxHoldSeconds != null ? `maxHold ${e.maxHoldSeconds}s` : null,
    e.invalidation ? `invalidation: ${str(e.invalidation).slice(0, 60)}` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "-";
}

export function evidenceBullets(p: Proposal): string[] {
  const out: string[] = [];
  const scores = asRecord(p.scores);
  const fromScores = scores?.evidenceBullets;
  if (Array.isArray(fromScores)) {
    for (const item of fromScores.slice(0, 5)) {
      if (typeof item === "string") out.push(`• ${item.slice(0, 200)}`);
      else {
        const r = asRecord(item);
        if (!r) continue;
        const title = str(r.title ?? r.text ?? r.body, "");
        const url = str(r.url ?? r.ref, "");
        const at = str(r.observedAt ?? "", "");
        const line = [title, url, at].filter((x) => x && x !== "-").join(" | ");
        if (line) out.push(`• ${line.slice(0, 220)}`);
      }
    }
  }
  if (Array.isArray(p.sources)) {
    for (const s of p.sources.slice(0, 5)) {
      if (typeof s === "string") {
        out.push(`• ${s.slice(0, 200)}`);
        continue;
      }
      const r = asRecord(s);
      if (!r) continue;
      const kind = str(r.kind ?? r.type, "");
      const title = str(r.title ?? r.note ?? "", "");
      const ref = str(r.ref ?? r.url ?? r.handle, "");
      const at = str(r.observedAt ?? "", "");
      const line = [kind, title, ref, at].filter((x) => x && x !== "-").join(" | ");
      if (line) out.push(`• ${line.slice(0, 220)}`);
    }
  }
  return [...new Set(out)].slice(0, 5);
}

export function riskLines(p: Proposal): string[] {
  const out: string[] = [];
  const scores = asRecord(p.scores);
  const named = [
    ["honeypot", "honeypot"],
    ["liq", "liquidity"],
    ["distribution", "distribution"],
    ["legal", "legal"],
    ["narrativeFade", "narrative-fade"],
    ["narrative_fade", "narrative-fade"],
  ] as const;
  const risks = asRecord(scores?.risks);
  for (const [k, label] of named) {
    const v = risks?.[k] ?? scores?.[k];
    if (v !== undefined && v !== null && v !== "") {
      out.push(`• ${label}: ${str(v).slice(0, 120)}`);
    }
  }
  const checks =
    scores?.hardRejectChecks ?? scores?.riskChecks ?? scores?.checks;
  if (Array.isArray(checks)) {
    for (const c of checks.slice(0, 8)) {
      if (typeof c === "string") {
        out.push(`• ${c.slice(0, 160)}`);
        continue;
      }
      const r = asRecord(c);
      if (!r) continue;
      const name = str(r.name ?? r.check ?? r.id, "check");
      const passed = r.passed ?? r.ok ?? r.status;
      const detail = str(r.detail ?? r.note, "");
      const mark =
        passed === true || passed === "pass" || passed === "passed"
          ? "PASS"
          : passed === false || passed === "fail"
            ? "FAIL"
            : str(passed, "?");
      out.push(
        `• [${mark}] ${name}${detail && detail !== "-" ? `: ${detail}` : ""}`.slice(
          0,
          180
        )
      );
    }
  }
  if (!out.length) {
    out.push("• (none attached — Desk should fill honeypot/liq/distribution/legal/narrative-fade)");
  }
  return out.slice(0, 8);
}

/** Section header with light emoji — plain text safe */
export function section(title: string, emoji = "▪️"): string {
  return `${emoji} ${title}`;
}

export function truncate(lines: string[]): string {
  const text = lines.join("\n");
  if (text.length <= TG_MAX) return text;
  return `${text.slice(0, TG_MAX - 18)}\n…(truncated)`;
}

/** Never truncate CA — full 0x… always. */
export function fullCa(p: Proposal): string {
  const raw = String(p.tokenCA ?? p.tokenAddress ?? "").trim();
  if (!raw) return "(missing CA — do not approve)";
  return raw;
}

function moneyUsd(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("$")) return s;
  const n = Number(s.replace(/,/g, ""));
  if (Number.isFinite(n)) return moneyUsd(n);
  return s;
}

/**
 * Pull mcap/liq from scores.market, top-level market, or flat scores fields.
 * Missing → honest incomplete labels (Nick: required on proposals).
 */
export function marketLines(
  p: Proposal,
  scores: Record<string, unknown> | null
): { mcapLine: string; liqLine: string; incomplete: boolean } {
  const market =
    asRecord((p as { market?: unknown }).market) ??
    asRecord(scores?.market) ??
    {};
  const mcapRaw =
    market.mcapUsd ??
    market.mcap ??
    market.marketCap ??
    scores?.mcapUsd ??
    scores?.mcap ??
    scores?.marketCap ??
    (p as { mcap?: unknown }).mcap ??
    (p as { marketCap?: unknown }).marketCap;
  const liqRaw =
    market.liqUsd ??
    market.liquidityUsd ??
    market.liq ??
    scores?.liqUsd ??
    scores?.liquidityUsd ??
    scores?.liq ??
    (p as { liq?: unknown }).liq;
  const mcapSrc = str(
    market.mcapSource ?? market.source ?? scores?.mcapSource ?? "",
    ""
  );
  const liqSrc = str(
    market.liqSource ?? market.pool ?? market.venue ?? scores?.liqSource ?? "",
    ""
  );
  const mcapAt = str(
    market.mcapObservedAt ?? market.observedAt ?? scores?.mcapObservedAt ?? "",
    ""
  );
  const liqAt = str(
    market.liqObservedAt ?? market.observedAt ?? scores?.liqObservedAt ?? "",
    ""
  );

  const mcapMoney = moneyUsd(mcapRaw);
  const liqMoney = moneyUsd(liqRaw);
  let incomplete = false;

  let mcapLine: string;
  if (mcapMoney) {
    const bits = [mcapMoney];
    if (mcapSrc && mcapSrc !== "-") bits.push(mcapSrc);
    if (mcapAt && mcapAt !== "-") bits.push(mcapAt);
    mcapLine = bits.join(" · ");
  } else {
    incomplete = true;
    mcapLine = "(missing — incomplete proposal)";
  }

  let liqLine: string;
  if (liqMoney) {
    const bits = [liqMoney];
    if (liqSrc && liqSrc !== "-") bits.push(liqSrc);
    if (liqAt && liqAt !== "-") bits.push(liqAt);
    liqLine = bits.join(" · ");
  } else {
    incomplete = true;
    liqLine = "(unknown — attach when known)";
  }

  return { mcapLine, liqLine, incomplete };
}
