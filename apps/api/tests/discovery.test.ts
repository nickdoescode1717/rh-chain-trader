import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { discoveryRoutes } from "../src/routes/discovery.js";
const app = new Hono().route("/discovery", discoveryRoutes);
test("discovery reports unavailable storage instead of returning fictional signals", async () => {
  for (const path of ["accounts", "signals", "launch-matches"]) {
    const response = await app.request(`/discovery/${path}`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "discovery_requires_postgres");
  }
});
test("account registration rejects malformed handles, booleans, and unknown fields", async () => {
  for (const body of [null, [], { handle: "invalid/handle" }, { handle: "valid", enabled: "false" },
    { handle: "valid", bearerToken: "not-a-real-token" }]) {
    const response = await app.request("/discovery/accounts", { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
});
