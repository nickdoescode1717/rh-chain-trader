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

/** Map 0-100 or 0-1 confidence to display */
export function scoreDisplay(v: unknown, asConfidence = false): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return str(v);
  if (asConfidence && n <= 1) return `${Math.round(n * 100)}/100`;
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
  // dedupe
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

export function section(title: string): string {
  return `—— ${title} ——`;
}

export function truncate(lines: string[]): string {
  const text = lines.join("\n");
  if (text.length <= TG_MAX) return text;
  return `${text.slice(0, TG_MAX - 18)}\n…(truncated)`;
}
