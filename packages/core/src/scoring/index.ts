import type {
  ScoreBreakdown,
  ScoreFramework,
  ScoringInput,
  ScoringResult,
  TokenCategory,
} from "../types/index.js";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const SOURCE_WEIGHTS: Record<string, number> = {
  onchain: 1.0,
  blockscout: 0.9,
  heuristic: 0.55,
  manual: 0.7,
  seed_fictional: 0.4,
};

/** Aggregate evidence confidence from individual evidence items. */
export function computeEvidenceConfidence(
  items: ScoringInput["evidenceItems"]
): number {
  if (!items.length) return 0.15;
  // Effective confidence = raw confidence × source reliability (no canceling normalize)
  let sum = 0;
  for (const item of items) {
    const w = SOURCE_WEIGHTS[item.source] ?? 0.5;
    sum += clamp01(item.confidence) * w;
  }
  return clamp01(sum / items.length);
}

function pickFramework(category: TokenCategory): ScoreFramework {
  if (category === "meme") return "meme";
  if (category === "utility" || category === "stable") return "utility";
  return "hybrid";
}

/**
 * Meme framework: momentum + narrative dominate; concentration and contract risk
 * are heavily weighted on the risk side.
 */
function scoreMeme(input: ScoringInput, evidenceConf: number): ScoringResult {
  const liquidity = clamp(input.liquidityScore);
  const momentum = clamp(input.volumeMomentum);
  const narrative = clamp(input.narrativeStrength);
  const socialBoost = clamp((input.socialMentions ?? 0) / 10, 0, 20);

  const opportunity = clamp(
    liquidity * 0.2 +
      momentum * 0.35 +
      narrative * 0.3 +
      socialBoost +
      evidenceConf * 15
  );

  const concentrationRisk = clamp(input.holderConcentration);
  const contractRisk = computeContractRisk(input);
  const agePenalty = input.ageDays < 3 ? 25 : input.ageDays < 14 ? 10 : 0;

  const risk = clamp(
    concentrationRisk * 0.4 +
      contractRisk * 0.35 +
      agePenalty +
      (100 - liquidity) * 0.1
  );

  const breakdown: ScoreBreakdown = {
    liquidity,
    momentum,
    holderConcentration: concentrationRisk,
    contractRisk,
    narrative,
    evidenceWeight: evidenceConf,
  };

  const rationale = [
    `Meme framework: opportunity driven by momentum (${momentum.toFixed(0)}) and narrative (${narrative.toFixed(0)}).`,
    `Risk elevated by holder concentration (${concentrationRisk.toFixed(0)}) and contract factors (${contractRisk.toFixed(0)}).`,
    `Evidence confidence: ${(evidenceConf * 100).toFixed(0)}%.`,
    input.ageDays < 7 ? "Token is very new — elevated uncertainty." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    opportunity: Math.round(opportunity * 10) / 10,
    risk: Math.round(risk * 10) / 10,
    evidenceConfidence: Math.round(evidenceConf * 1000) / 1000,
    framework: "meme",
    breakdown,
    rationale,
  };
}

/**
 * Utility framework: liquidity, verification, and utility signals dominate;
 * narrative is secondary.
 */
function scoreUtility(input: ScoringInput, evidenceConf: number): ScoringResult {
  const liquidity = clamp(input.liquidityScore);
  const utility = clamp(input.utilitySignals ?? 40);
  const momentum = clamp(input.volumeMomentum);
  const narrative = clamp(input.narrativeStrength);

  const opportunity = clamp(
    liquidity * 0.3 +
      utility * 0.35 +
      momentum * 0.15 +
      narrative * 0.1 +
      evidenceConf * 20
  );

  const concentrationRisk = clamp(input.holderConcentration * 0.7);
  const contractRisk = computeContractRisk(input);
  const ageBonus = input.ageDays > 90 ? -5 : 0;

  const risk = clamp(
    concentrationRisk * 0.3 +
      contractRisk * 0.45 +
      (100 - liquidity) * 0.15 +
      (100 - utility) * 0.1 +
      ageBonus
  );

  const breakdown: ScoreBreakdown = {
    liquidity,
    momentum,
    holderConcentration: concentrationRisk,
    contractRisk,
    narrative,
    evidenceWeight: evidenceConf,
  };

  const rationale = [
    `Utility framework: opportunity driven by liquidity (${liquidity.toFixed(0)}) and utility signals (${utility.toFixed(0)}).`,
    `Contract risk (${contractRisk.toFixed(0)}) and concentration (${concentrationRisk.toFixed(0)}) set risk floor.`,
    `Evidence confidence: ${(evidenceConf * 100).toFixed(0)}%.`,
  ].join(" ");

  return {
    opportunity: Math.round(opportunity * 10) / 10,
    risk: Math.round(risk * 10) / 10,
    evidenceConfidence: Math.round(evidenceConf * 1000) / 1000,
    framework: "utility",
    breakdown,
    rationale,
  };
}

function scoreHybrid(input: ScoringInput, evidenceConf: number): ScoringResult {
  const meme = scoreMeme(input, evidenceConf);
  const util = scoreUtility(input, evidenceConf);
  const opportunity = clamp((meme.opportunity + util.opportunity) / 2);
  const risk = clamp((meme.risk + util.risk) / 2);

  return {
    opportunity: Math.round(opportunity * 10) / 10,
    risk: Math.round(risk * 10) / 10,
    evidenceConfidence: Math.round(evidenceConf * 1000) / 1000,
    framework: "hybrid",
    breakdown: {
      liquidity: (meme.breakdown.liquidity + util.breakdown.liquidity) / 2,
      momentum: (meme.breakdown.momentum + util.breakdown.momentum) / 2,
      holderConcentration:
        (meme.breakdown.holderConcentration +
          util.breakdown.holderConcentration) /
        2,
      contractRisk:
        (meme.breakdown.contractRisk + util.breakdown.contractRisk) / 2,
      narrative: (meme.breakdown.narrative + util.breakdown.narrative) / 2,
      evidenceWeight: evidenceConf,
    },
    rationale: `Hybrid framework (averaged meme + utility). ${meme.rationale} | ${util.rationale}`,
  };
}

function computeContractRisk(input: ScoringInput): number {
  let risk = 40;
  if (!input.contractVerified) risk += 30;
  if (input.hasProxy) risk += 15;
  if (input.ageDays < 1) risk += 20;
  return clamp(risk);
}

/** Primary scoring entry point. */
export function scoreToken(input: ScoringInput): ScoringResult {
  const evidenceConf = computeEvidenceConfidence(input.evidenceItems);
  const framework = pickFramework(input.category);

  switch (framework) {
    case "meme":
      return scoreMeme(input, evidenceConf);
    case "utility":
      return scoreUtility(input, evidenceConf);
    default:
      return scoreHybrid(input, evidenceConf);
  }
}

/** Risk heuristics for quick triage. */
export function assessRiskFlags(input: ScoringInput): string[] {
  const flags: string[] = [];
  if (!input.contractVerified) flags.push("UNVERIFIED_CONTRACT");
  if (input.hasProxy) flags.push("PROXY_CONTRACT");
  if (input.holderConcentration >= 70) flags.push("HIGH_HOLDER_CONCENTRATION");
  if (input.liquidityScore < 20) flags.push("LOW_LIQUIDITY");
  if (input.ageDays < 3) flags.push("VERY_NEW_TOKEN");
  if (input.evidenceItems.length === 0) flags.push("NO_EVIDENCE");
  if (
    input.evidenceItems.every(
      (e) => e.source === "seed_fictional" || e.source === "heuristic"
    )
  ) {
    flags.push("WEAK_EVIDENCE_SOURCES");
  }
  return flags;
}

export type { ScoringInput, ScoringResult, ScoreBreakdown, ScoreFramework };
