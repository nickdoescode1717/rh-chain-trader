import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { researchRoutes } from "../src/routes/research.js";
const app = new Hono().route("/research", researchRoutes);
test("research endpoints report unavailable storage without fabricated reports", async () => {
  for (const path of ["projects", "projects/tradedotcv", "projects/tradedotcv/grok-handoff"]) {
    const response = await app.request(`/research/${path}`);
    assert.equal(response.status, 503); assert.equal((await response.json()).error, "research_requires_postgres");
  }
});
test("project registration rejects malformed fields, private target syntax, credentials and execution flags", async () => {
  const valid = { handle: "tradedotcv", domain: "trade.cv" };
  for (const body of [null, [], {}, { ...valid, handle: "invalid/handle" }, { ...valid, domain: "127.0.0.1" },
    { ...valid, domain: "https://trade.cv" }, { ...valid, domain: "service.internal" }, { ...valid, category: ["utility"] },
    { ...valid, enabled: "true" }, { ...valid, apiKey: "test-placeholder" }, { ...valid, autoBuyEnabled: true }]) {
    const response = await app.request("/research/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  const response = await app.request("/research/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(valid) });
  assert.equal(response.status, 503);
});
