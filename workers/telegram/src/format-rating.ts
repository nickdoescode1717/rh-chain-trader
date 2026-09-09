/**
 * Desk overall /10 rollup for TG alerts (SoT 2026-09-09).
 * quality = (opp/100) * ((100-risk)/100) * (evidenceConfidence/100)
 * overall10 = round(quality * 10)
 * Caps: risk>=80 → max 3; evidenceConfidence<40 → max 4
 * Hard-reject → 0/10
 * Note: opp/risk/evidence may arrive as 0–1 or 0–100 — normalize both.
 */

import type { Proposal } from "./api.js";
import { asRecord, str, toHundred } from "./format-desk.js";

/** Treat values in (0,1] as fractions for any score axis */
function score100(v: unknown): number {
  const n = toHundred(v, true);
  return n == null ? 0 : n;
}

export function overallRating(
  scores: Record<string, unknown> | null,
  p?: Proposal
): { overall: number; emoji: string; line: string; rejected: boolean } {
  const hard = hasHardReject(scores, p);
  if (hard) {
    return {
      overall: 0,
      emoji: "⛔",
      line: "⛔ 0/10 REJECT · hard-reject",
      rejected: true,
    };
  }

  const opp = score100(scores?.opportunity);
  const risk = score100(scores?.risk);
  const conf = score100(scores?.evidenceConfidence ?? scores?.evidence);

  let quality = (opp / 100) * ((100 - risk) / 100) * (conf / 100);
  if (quality < 0) quality = 0;
  if (quality > 1) quality = 1;
  let overall = Math.round(quality * 10);

  if (risk >= 80 && overall > 3) overall = 3;
  if (conf < 40 && overall > 4) overall = 4;

  let emoji = "🔴";
  if (overall >= 8) emoji = "🟢";
  else if (overall >= 5) emoji = "🟡";
  else if (overall <= 0) emoji = "⛔";

  return {
    overall,
    emoji,
    line: `${emoji} ${overall}/10`,
    rejected: false,
  };
}

function hasHardReject(
  scores: Record<string, unknown> | null,
  p?: Proposal
): boolean {
  if (!scores && !p) return false;
  const gate = str(scores?.gate ?? scores?.overallGate, "").toLowerCase();
  if (["fail", "failed", "reject", "rejected"].includes(gate)) return true;

  const checks = scores?.hardRejectChecks ?? scores?.riskChecks ?? scores?.checks;
  if (Array.isArray(checks)) {
    for (const c of checks) {
      const r = asRecord(c);
      if (!r) continue;
      const passed = r.passed ?? r.ok ?? r.status;
      if (passed === false || passed === "fail" || passed === "failed") return true;
    }
  }
  if (p?.leadSource === "ct" && scores?.hardRejectCtAlone === true) return true;
  return false;
}
