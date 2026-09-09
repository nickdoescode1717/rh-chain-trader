/**
 * Standalone risk heuristics for research triage.
 * No trading or signing — advisory only.
 */

export interface RiskContext {
  contractVerified: boolean;
  hasProxy: boolean;
  holderTop10Pct: number;
  liquidityUsd: number;
  ageHours: number;
  mintAuthorityActive?: boolean;
  pauseFunctionPresent?: boolean;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0–100
  flags: string[];
  summary: string;
}

export function assessRisk(ctx: RiskContext): RiskAssessment {
  const flags: string[] = [];
  let score = 20;

  if (!ctx.contractVerified) {
    flags.push("UNVERIFIED_CONTRACT");
    score += 25;
  }
  if (ctx.hasProxy) {
    flags.push("UPGRADEABLE_PROXY");
    score += 12;
  }
  if (ctx.holderTop10Pct >= 80) {
    flags.push("EXTREME_CONCENTRATION");
    score += 30;
  } else if (ctx.holderTop10Pct >= 60) {
    flags.push("HIGH_CONCENTRATION");
    score += 18;
  }
  if (ctx.liquidityUsd < 5_000) {
    flags.push("ILLIQUID");
    score += 20;
  } else if (ctx.liquidityUsd < 25_000) {
    flags.push("THIN_LIQUIDITY");
    score += 10;
  }
  if (ctx.ageHours < 24) {
    flags.push("LAUNCH_WINDOW");
    score += 15;
  } else if (ctx.ageHours < 72) {
    flags.push("EARLY_TOKEN");
    score += 8;
  }
  if (ctx.mintAuthorityActive) {
    flags.push("ACTIVE_MINT_AUTHORITY");
    score += 20;
  }
  if (ctx.pauseFunctionPresent) {
    flags.push("PAUSEABLE");
    score += 8;
  }

  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel;
  if (score >= 75) level = "critical";
  else if (score >= 55) level = "high";
  else if (score >= 35) level = "medium";
  else level = "low";

  const summary = `Risk ${level} (${score}/100): ${flags.length ? flags.join(", ") : "no major flags"}. Research only — not investment advice.`;

  return { level, score, flags, summary };
}
