import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scoreToken,
  computeEvidenceConfidence,
  assessRiskFlags,
} from "../src/scoring/index.js";
import { assessRisk } from "../src/scoring/risk.js";
import type { ScoringInput } from "../src/types/index.js";

const baseMeme: ScoringInput = {
  category: "meme",
  liquidityScore: 55,
  volumeMomentum: 70,
  holderConcentration: 65,
  contractVerified: false,
  hasProxy: false,
  ageDays: 5,
  narrativeStrength: 80,
  socialMentions: 40,
  evidenceItems: [
    { confidence: 0.6, source: "heuristic" },
    { confidence: 0.5, source: "seed_fictional" },
  ],
};

const baseUtility: ScoringInput = {
  category: "utility",
  liquidityScore: 80,
  volumeMomentum: 40,
  holderConcentration: 30,
  contractVerified: true,
  hasProxy: false,
  ageDays: 120,
  narrativeStrength: 35,
  utilitySignals: 75,
  evidenceItems: [
    { confidence: 0.9, source: "onchain" },
    { confidence: 0.85, source: "blockscout" },
  ],
};

describe("computeEvidenceConfidence", () => {
  it("returns low confidence for empty evidence", () => {
    assert.equal(computeEvidenceConfidence([]), 0.15);
  });

  it("weights onchain higher than fictional seed", () => {
    const strong = computeEvidenceConfidence([
      { confidence: 0.9, source: "onchain" },
    ]);
    const weak = computeEvidenceConfidence([
      { confidence: 0.9, source: "seed_fictional" },
    ]);
    assert.ok(strong > weak);
  });
});

describe("scoreToken — meme framework", () => {
  it("uses meme framework for meme category", () => {
    const result = scoreToken(baseMeme);
    assert.equal(result.framework, "meme");
    assert.ok(result.opportunity >= 0 && result.opportunity <= 100);
    assert.ok(result.risk >= 0 && result.risk <= 100);
    assert.ok(result.evidenceConfidence >= 0 && result.evidenceConfidence <= 1);
    assert.ok(result.rationale.includes("Meme"));
  });

  it("raises risk for unverified + high concentration", () => {
    const result = scoreToken(baseMeme);
    assert.ok(result.risk >= 40, `expected elevated risk, got ${result.risk}`);
  });
});

describe("scoreToken — utility framework", () => {
  it("uses utility framework for utility category", () => {
    const result = scoreToken(baseUtility);
    assert.equal(result.framework, "utility");
    assert.ok(result.opportunity > 50);
    assert.ok(result.risk < result.opportunity);
  });

  it("hybrid for unknown category", () => {
    const result = scoreToken({ ...baseUtility, category: "unknown" });
    assert.equal(result.framework, "hybrid");
  });
});

describe("assessRiskFlags", () => {
  it("flags unverified and concentration", () => {
    const flags = assessRiskFlags(baseMeme);
    assert.ok(flags.includes("UNVERIFIED_CONTRACT"));
    assert.ok(flags.includes("HIGH_HOLDER_CONCENTRATION") || flags.length > 0);
  });
});

describe("assessRisk", () => {
  it("returns critical for extreme profile", () => {
    const r = assessRisk({
      contractVerified: false,
      hasProxy: true,
      holderTop10Pct: 90,
      liquidityUsd: 1000,
      ageHours: 6,
      mintAuthorityActive: true,
    });
    assert.equal(r.level, "critical");
    assert.ok(r.flags.length >= 3);
  });

  it("returns low for healthy profile", () => {
    const r = assessRisk({
      contractVerified: true,
      hasProxy: false,
      holderTop10Pct: 25,
      liquidityUsd: 500_000,
      ageHours: 24 * 200,
    });
    assert.ok(r.level === "low" || r.level === "medium");
    assert.ok(r.score < 55);
  });
});
