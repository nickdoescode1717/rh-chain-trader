/** Syntax only; network clients must separately validate and pin public DNS results. */
export function normalizePublicDomain(raw: string): string {
  const domain = raw.trim().toLowerCase();
  if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
    || /\.(localhost|local|internal|test|invalid|example)$/.test(domain)) throw new Error("invalid_public_domain");
  return domain;
}

export const PROJECT_CHECKS = {
  publicWebsite: { label: "Public website", weight: 5 },
  identityLinkage: { label: "Official identity and domain linkage", weight: 10 },
  documentation: { label: "Substantive public documentation", weight: 10 },
  developmentHistory: { label: "Repository and release history", weight: 10 },
  publicDevSurfaces: { label: "Public development/API/staging evidence", weight: 5 },
  workingProduct: { label: "Working product and delivery", weight: 15 },
  tokenEconomics: { label: "Token utility, supply and unlocks", weight: 10 },
  contractProvenance: { label: "Issuer, token and deployer provenance", weight: 15 },
  contractSafety: { label: "Permissions, liquidity and sellability checks", weight: 15 },
  realUsage: { label: "Independent usage and traction evidence", weight: 5 },
} as const;
export type ProjectCheckId = keyof typeof PROJECT_CHECKS;
export type ProjectEvidence = { id: string; url: string; observedAt: string; finding: string; kind: string };
export type ProjectCheck = { id: ProjectCheckId; status: "supported" | "concern" | "unknown";
  sourceIds: string[]; explanation: string };

/** Transparent research-evidence rating, never a probability of legitimacy or investment return. */
export function rateProject(checks: ProjectCheck[], evidence: ProjectEvidence[]) {
  const validSources = new Set(evidence.map((e) => e.id));
  let supported = 0, concerns = 0, coverage = 0;
  const normalized = Object.entries(PROJECT_CHECKS).map(([key, definition]) => {
    const matching = checks.filter((c) => c.id === key);
    const supplied = matching.length === 1 ? matching[0] : undefined;
    const grounded = supplied && supplied.sourceIds.length > 0 && supplied.sourceIds.every((id) => validSources.has(id));
    const status = grounded && ["supported", "concern", "unknown"].includes(supplied.status) ? supplied.status : "unknown";
    if (status !== "unknown") coverage += definition.weight;
    if (status === "supported") supported += definition.weight;
    if (status === "concern") concerns += definition.weight;
    return { ...definition, id: key, status, sourceIds: grounded ? supplied.sourceIds : [],
      explanation: grounded ? supplied.explanation : "Unknown: requires traceable evidence." };
  });
  return { rating10: coverage >= 50 ? Math.round((supported / 100) * 100) / 10 : null,
    evidenceCoveragePct: coverage, supportedEvidencePoints: supported, concernPoints: concerns,
    legitimacy: "unverified" as const, status: coverage < 50 ? "insufficient_evidence" : "research_only",
    checks: normalized,
    note: "Evidence rubric, not a calibrated legitimacy probability. Subdomains contribute at most 5/100. Unknowns are not proof of fraud. No investment valuation without market and contract data." };
}

export function projectLaunchReadiness(input: { domainVerified?: boolean; officialTokenVerified?: boolean;
  deployerVerified?: boolean; contractChecksPassed?: boolean; quoteSimulationPassed?: boolean;
  policyConfigured?: boolean; signerConnected?: boolean }) {
  const conditions = {
    domainVerified: "official_domain_relationship_unverified",
    officialTokenVerified: "official_token_unverified",
    deployerVerified: "deployer_unverified",
    contractChecksPassed: "contract_liquidity_tax_and_sellability_checks_required",
    quoteSimulationPassed: "current_quote_and_simulation_required",
    policyConfigured: "per_token_daily_spend_slippage_and_exit_policy_required",
    signerConnected: "isolated_signer_not_connected",
  } as const;
  const blockers = Object.entries(conditions).filter(([key]) => input[key as keyof typeof input] !== true).map(([, reason]) => reason);
  return { status: blockers.length ? "watch_only" : "ready_for_execution_review", blockers,
    autoBuyEnabled: false, signed: false, txSubmitted: false };
}
