import assert from "node:assert/strict";
import { test } from "node:test";
import { PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED } from "@rh/core";
import { ponsDeployment } from "../src/launch-preparation.js";
import { inspectLaunch } from "../src/research/launch-dd.js";
const address = "0x" + "a".repeat(40), topic = "0x" + "0".repeat(24) + "a".repeat(40);
const event = () => ({ address: PONS_V2_LAUNCH_FACTORY, topics: [PONS_V2_TOKEN_LAUNCHED, topic, topic, topic],
  transactionHash: "0x" + "b".repeat(64), blockHash: "0x" + "c".repeat(64), blockNumber: "0x123", logIndex: "0x0", data: "0x" });
test("deployment envelope rejects copycat factories, malformed topics, removed logs and wrong chain", () => {
  assert.equal(ponsDeployment(event(), 4663)?.deployerAddress, address);
  assert.equal(ponsDeployment(event(), 1), null);
  for (const change of [{ address }, { removed: true }, { blockHash: undefined }, { topics: [PONS_V2_TOKEN_LAUNCHED, topic] },
    { topics: [PONS_V2_TOKEN_LAUNCHED, "0x" + "1".repeat(64), topic, topic] }, { blockNumber: "0xFFFFFFFFFFFF" }])
    assert.equal(ponsDeployment({ ...event(), ...change }, 4663), null);
});
test("additional DD reuses sources, caps public reads and never fetches external or private links", async () => {
  const calls: string[] = [], discovery = { observedAt: new Date().toISOString(), primaryHandle: "project", domain: "project.org", accounts: [], domains: [],
    addresses: [], gaps: [], links: ["https://copycat.org/docs", "https://127.0.0.1/docs", ...Array.from({ length: 10 }, (_, i) => `https://project.org/docs/${i}`)].map(url => ({ url, kind: "project_page", sourceUrl: "https://project.org/" })) };
  const r = await inspectLaunch(discovery, [{ url: "https://project.org/docs/0", text: `Deployer: <code>${address}</code>`, kind: "website", observedAt: new Date().toISOString() }], async url => {
    calls.push(url); return { url, status: 200, contentType: "text/html", text: `Robinhood Chain token address: ${address}` };
  });
  assert.equal(calls.length, 6); assert.ok(calls.every(u => u.startsWith("https://project.org/")));
  assert.ok(!calls.includes("https://project.org/docs/0")); assert.ok(r.candidates.some(c => c.role === "deployer"));
  assert.ok(r.gaps.includes("launch_document_limit_reached"));
});
