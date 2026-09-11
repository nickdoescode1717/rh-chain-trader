import assert from "node:assert/strict";
import { test } from "node:test";
import { launchCandidates, freshLaunchCandidates, type LaunchDocument, type LaunchReport } from "../src/launch.js";
const address = "0x" + "a".repeat(40), other = "0x" + "b".repeat(40);
const doc = (text: string, kind: LaunchDocument["kind"] = "website", url = "https://project.org/docs"): LaunchDocument => ({ text, kind, url, observedAt: new Date().toISOString() });
test("launch candidates distinguish deployers, factories and arbitrary mentions without granting trust", () => {
  assert.equal(launchCandidates([doc(`Deployer address: ${address}`)], "project.org")[0].role, "deployer");
  assert.equal(launchCandidates([doc(`Factory: ${address}`)], "project.org")[0].role, "factory");
  assert.equal(launchCandidates([doc(`Team uses ${address}`)], "project.org")[0].role, "mention");
  assert.equal(launchCandidates([doc(`Example deployer: ${address}`)], "project.org")[0].role, "mention");
  assert.equal(launchCandidates([doc(`Robinhood Chain token address: ${address}`)], "project.org")[0].tokenDeclaration, true);
});
test("wrong domain, X posts, competing tokens, missing chain, fake declarations cannot draft identity", () => {
  for (const d of [doc(`Token address: ${address}`), doc(`Chain ID: 1. Token address: ${address}`),
    doc(`Robinhood Chain token address: ${address}`, "post"), doc(`Robinhood Chain token address: ${address}`, "website", "https://copycat.org/docs"),
    doc(`Robinhood Chain token address: ${address}. Token address: ${other}`), doc(`Example Robinhood Chain token address: ${address}`)])
    assert.ok(launchCandidates([d], "project.org").every(c => !c.tokenDeclaration));
});
test("candidate matching expires cached source observations, including future timestamps", () => {
  const candidates = launchCandidates([doc(`Deployer: ${address}`)], "project.org");
  const report: LaunchReport = { version: 1, observedAt: new Date().toISOString(), domain: "project.org", candidates, matches: [], gaps: [], pagesChecked: [] };
  assert.equal(freshLaunchCandidates(report).length, 1);
  candidates[0].observedAt = new Date(Date.now() - 86_400_001).toISOString(); assert.equal(freshLaunchCandidates(report).length, 0);
  candidates[0].observedAt = new Date(Date.now() + 60_000).toISOString(); assert.equal(freshLaunchCandidates(report).length, 0);
});
