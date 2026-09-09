import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePublicDomain, PROJECT_CHECKS, projectLaunchReadiness, rateProject, type ProjectCheck, type ProjectCheckId } from "../src/research.js";
const evidence = [{ id: "e1", url: "https://platform.com/", observedAt: "2026-09-09T00:00:00Z", finding: "Public source", kind: "website" }];
const check = (id: ProjectCheckId, status: ProjectCheck["status"] = "supported"): ProjectCheck => ({ id, status, sourceIds: ["e1"], explanation: "Reviewed evidence" });
test("website and subdomains cannot establish legitimacy or an overall rating", () => {
  const result = rateProject([check("publicWebsite"), check("publicDevSurfaces")], evidence);
  assert.equal(result.rating10, null); assert.equal(result.evidenceCoveragePct, 10);
  assert.equal(result.supportedEvidencePoints, 10); assert.equal(result.legitimacy, "unverified");
  assert.equal(result.checks.length, 10);
});
test("unsupported references and duplicate checks do not inflate evidence coverage", () => {
  const result = rateProject([{ ...check("contractSafety"), sourceIds: ["invented"] }, check("publicWebsite"), check("publicWebsite")], evidence);
  assert.equal(result.evidenceCoveragePct, 0); assert.equal(result.rating10, null);
});
test("concerns contribute coverage but never positive evidence points", () => {
  const checks = (Object.keys(PROJECT_CHECKS) as ProjectCheckId[]).map((id) => check(id, id === "contractSafety" ? "concern" : "supported"));
  const result = rateProject(checks, evidence);
  assert.equal(result.rating10, 8.5); assert.equal(result.concernPoints, 15); assert.equal(result.evidenceCoveragePct, 100);
  assert.equal(result.legitimacy, "unverified");
});
test("readiness never signs or authorizes a purchase even when supplied all checks", () => {
  assert.equal(projectLaunchReadiness({}).blockers.length, 7);
  const result = projectLaunchReadiness({ domainVerified: true, officialTokenVerified: true, deployerVerified: true,
    contractChecksPassed: true, quoteSimulationPassed: true, policyConfigured: true, signerConnected: true });
  assert.equal(result.status, "ready_for_execution_review"); assert.equal(result.autoBuyEnabled, false);
  assert.equal(result.signed, false); assert.equal(result.txSubmitted, false);
});
test("domain input accepts DNS names only, not URLs, IP literals, credentials or local targets", () => {
  assert.equal(normalizePublicDomain(" TRADE.CV "), "trade.cv");
  for (const invalid of ["localhost", "host.local", "https://trade.cv", "127.0.0.1", "::1", "user@trade.cv", "trade.cv/path", "trade.cv:443", "-host.com", "*.trade.cv"]) assert.throws(() => normalizePublicDomain(invalid));
});
