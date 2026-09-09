import assert from "node:assert/strict";
import { test } from "node:test";
import { certificateHosts, inspectProject, linkedHosts } from "../src/research/inspect.js";
import { enrichWithGrok } from "../src/research/grok.js";
import { publicIPv4, readPublicPage, withinDomain } from "../src/research/public-web.js";
const input = { handle: "tradedotcv", domain: "trade.cv", category: "utility" };
const content = "Public product description. ".repeat(10);
test("passive discovery excludes wildcard certificates, suffix tricks and unrelated sites", () => {
  assert.deepEqual(certificateHosts([{ name_value: "*.trade.cv\napi.trade.cv\ntrade.cv.evil.com\napi.trade.cv" }], "trade.cv"), ["api.trade.cv"]);
  assert.deepEqual(linkedHosts('<a href="https://docs.trade.cv/x">docs</a><a href="https://trade.cv.evil.com">bad</a><a href="http://api.trade.cv">http</a>', "trade.cv"), ["docs.trade.cv"]);
  assert.equal(withinDomain("eviltrade.cv", "trade.cv"), false);
});
test("public fetch refuses private, shared, reserved addresses and out of scope URLs", async () => {
  for (const ip of ["127.0.0.1", "10.1.1.1", "172.16.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "192.0.2.1", "::1", "::ffff:127.0.0.1"]) assert.equal(publicIPv4(ip), false, ip);
  assert.equal(publicIPv4("8.8.8.8"), true);
  for (const url of ["https://127.0.0.1/", "http://trade.cv/", "https://user:pass@trade.cv/", "https://trade.cv:8443/", "https://evil.com/"]) await assert.rejects(readPublicPage(url, "trade.cv"));
});
test("inspection caps discovered hosts, never guesses routes, and gives subdomains only five points", async () => {
  const requests: string[] = [];
  const report = await inspectProject(input, async (url) => {
    requests.push(url);
    if (url.includes("crt.sh")) return { url, status: 200, contentType: "application/json", text: JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ name_value: `s${i}.trade.cv` }))) };
    return { url, status: 200, contentType: "text/html", text: content + '<a href="https://api.trade.cv">API</a>' };
  }, new Date("2026-09-09T00:00:00Z"));
  assert.equal(report.subdomains.discovered, 13); assert.equal(report.subdomains.inspected.length, 8); assert.equal(report.subdomains.truncated, true);
  assert.equal(requests.length, 10); assert.ok(requests.filter((url) => !url.includes("crt.sh")).every((url) => new URL(url).pathname === "/"));
  assert.equal(report.rating.supportedEvidencePoints, 10); assert.equal(report.rating.rating10, null);
  assert.equal(report.launchReadiness.autoBuyEnabled, false);
});
test("unavailable sources remain unknown and expose coverage errors", async () => {
  const report = await inspectProject(input, async () => { throw new Error("network unavailable"); });
  assert.equal(report.rating.evidenceCoveragePct, 0); assert.equal(report.rating.concernPoints, 0);
  assert.deepEqual(report.subdomains.errors, ["homepage_unavailable", "certificate_transparency_unavailable"]);
});
test("Grok opt-in, citation checks and output whitelist isolate model output from execution", async () => {
  const previous = { enabled: process.env.GROK_RESEARCH_ENABLED, key: process.env.XAI_API_KEY, model: process.env.XAI_MODEL };
  try {
    const report = await inspectProject(input, async (url) => ({ url, status: 200, contentType: "text/html", text: content }));
    let calls = 0;
    process.env.GROK_RESEARCH_ENABLED = "false";
    assert.equal((await enrichWithGrok(report, async () => { calls++; throw new Error(); })).status, "disabled"); assert.equal(calls, 0);
    process.env.GROK_RESEARCH_ENABLED = "true"; process.env.XAI_API_KEY = "test-placeholder"; process.env.XAI_MODEL = "test-model";
    const analysis = { summary: "Issuer claims remain unverified", strengths: [], concerns: [], missingEvidence: ["Official contract"], evidenceIds: ["e1"], autoBuyEnabled: true, rating10: 10 };
    const result = await enrichWithGrok(report, async (url, options) => {
      assert.equal(url, "https://api.x.ai/v1/chat/completions");
      const body = JSON.parse(String(options?.body)); assert.equal(body.tools, undefined); assert.equal(options?.redirect, "error");
      return Response.json({ choices: [{ message: { content: JSON.stringify(analysis) } }] });
    });
    assert.equal(result.status, "completed_unverified_model_analysis");
    assert.equal("autoBuyEnabled" in result.analysis!, false); assert.equal("rating10" in result.analysis!, false);
    assert.equal(report.launchReadiness.autoBuyEnabled, false);
    analysis.evidenceIds = ["invented-source"];
    const invalid = await enrichWithGrok(report, async () => Response.json({ choices: [{ message: { content: JSON.stringify(analysis) } }] }));
    assert.equal(invalid.analysis, null); assert.equal(invalid.status, "analysis_unavailable_or_invalid");
  } finally {
    for (const [name, value] of [["GROK_RESEARCH_ENABLED", previous.enabled], ["XAI_API_KEY", previous.key], ["XAI_MODEL", previous.model]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
});
