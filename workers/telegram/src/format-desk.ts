/**
 * Desk-depth helpers for Telegram paper proposal alerts (plain text).
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

export function shortCa(ca: string | undefined | null): string {
  if (!ca) return "-";
  if (ca.length <= 14) return ca;
  return `${ca.slice(0, 8)}...${ca.slice(-6)}`;
}

export function sizeLine(p: Proposal): string {
  if (p.sizeEth != null && p.sizeEth !== "") return `${p.sizeEth} ETH (paper)`;
  if (p.sizeUsd != null && p.sizeUsd !== "") return `$${p.sizeUsd} (paper)`;
  if (typeof p.size === "string" && p.size) return `${p.size} (paper)`;
  return "-";
}

export function leadLabel(lead: string | null | undefined): string {
  if (lead === "ct") return "CT (Crypto Twitter)";
  if (lead === "watched_wallet") return "Watched wallet";
  return lead ? String(lead) : "-";
}

export function gateLine(scores: Record<string, unknown> | null): string {
  if (!scores) return "Gate: UNKNOWN (no scores)";
  const raw =
    scores.gate ?? scores.overallGate ?? scores.clear ?? scores.passed;
  if (typeof raw === "boolean") return raw ? "Gate: CLEAR" : "Gate: FAIL";
  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    if (["clear", "pass", "passed", "yes", "true"].includes(s)) return "Gate: CLEAR";
    if (["fail", "failed", "reject", "no", "false"].includes(s)) return "Gate: FAIL";
    return `Gate: ${raw}`;
  }
  const risk = Number(scores.risk);
  const conf = Number(scores.evidenceConfidence ?? scores.evidence);
  if (Number.isFinite(risk) && risk >= 80) return "Gate: FAIL (risk>=80 heuristic)";
  if (Number.isFinite(conf) && conf < 0.35) return "Gate: FAIL (evidence-confidence low)";
  if (Number.isFinite(risk) && Number.isFinite(conf)) return "Gate: CLEAR (heuristic)";
  return "Gate: UNKNOWN";
}

export function evidenceBullets(p: Proposal): string[] {
  const out: string[] = [];
  const scores = asRecord(p.scores);
  const fromScores = scores?.evidenceBullets ?? scores?.evidence;
  if (Array.isArray(fromScores)) {
    for (const item of fromScores.slice(0, 5)) {
      if (typeof item === "string") out.push(`- ${item.slice(0, 220)}`);
      else {
        const r = asRecord(item);
        if (r) {
          const title = str(r.title ?? r.text ?? r.body, "");
          const src = str(r.source ?? r.handle ?? r.url, "");
          const line = [title, src].filter(Boolean).join(" | ");
          if (line) out.push(`- ${line.slice(0, 220)}`);
        }
      }
    }
  }
  if (Array.isArray(p.sources)) {
    for (const s of p.sources.slice(0, 5)) {
      if (typeof s === "string") {
        out.push(`- ${s.slice(0, 220)}`);
        continue;
      }
      const r = asRecord(s);
      if (!r) continue;
      const kind = str(r.kind ?? r.type ?? r.source, "");
      const ref = str(r.ref ?? r.url ?? r.handle ?? r.title, "");
      const note = str(r.note ?? r.body ?? "", "");
      const line = [kind, ref, note].filter((x) => x && x !== "-").join(" | ");
      if (line) out.push(`- ${line.slice(0, 220)}`);
    }
  }
  return out.slice(0, 6);
}

export function riskChecks(p: Proposal): string[] {
  const out: string[] = [];
  const scores = asRecord(p.scores);
  const checks =
    scores?.hardRejectChecks ??
    scores?.riskChecks ??
    scores?.checks ??
    (p as { riskChecks?: unknown }).riskChecks;
  if (Array.isArray(checks)) {
    for (const c of checks.slice(0, 8)) {
      if (typeof c === "string") out.push(`- ${c.slice(0, 180)}`);
      else {
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
          `- [${mark}] ${name}${detail && detail !== "-" ? `: ${detail}` : ""}`.slice(
            0,
            200
          )
        );
      }
    }
  }
  return out;
}

export function exitsLine(p: Proposal): string | null {
  const e = asRecord(p.exits);
  if (!e) return null;
  const bits = [
    e.tpPct != null ? `TP ${e.tpPct}%` : null,
    e.slPct != null ? `SL ${e.slPct}%` : null,
    e.trailPct != null ? `trail ${e.trailPct}%` : null,
    e.maxHoldSeconds != null ? `maxHold ${e.maxHoldSeconds}s` : null,
  ].filter(Boolean);
  return bits.length ? `Exits: ${bits.join(" | ")}` : null;
}

export function truncate(lines: string[]): string {
  const text = lines.join("\n");
  if (text.length <= TG_MAX) return text;
  return `${text.slice(0, TG_MAX - 20)}\n…(truncated)`;
}
