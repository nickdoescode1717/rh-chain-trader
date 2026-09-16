import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { Hono } from "hono";
import { paperSellRoutes } from "../src/routes/paper-sells.js";
import { positionRoutes } from "../src/routes/positions.js";
import { paperBalanceRoutes } from "../src/routes/paper-balance.js";
import { purchaseProposalRoutes } from "../src/routes/purchase-proposals.js";
const env = { ...process.env };
afterEach(() => { for (const k of ["TELEGRAM_APPROVAL_TOKEN", "TELEGRAM_OWNER_USER_ID", "TELEGRAM_CHAT_ID", "PAPER_LEDGER_ENABLED"]) {
  if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k];
} });
test("paper decisions require service credential and owner; database outages cannot fall back to memory", async () => {
  process.env.TELEGRAM_APPROVAL_TOKEN = "x".repeat(64); process.env.TELEGRAM_OWNER_USER_ID = "42";
  process.env.TELEGRAM_CHAT_ID = "42"; process.env.PAPER_LEDGER_ENABLED = "true";
  const app = new Hono(); app.route("/paper-sells", paperSellRoutes); app.route("/positions", positionRoutes);
  app.route("/paper-balance", paperBalanceRoutes); app.route("/purchase-proposals", purchaseProposalRoutes);
  const id = "11111111-1111-4111-8111-111111111111";
  const request = (path: string, body: unknown, secret = "x".repeat(64)) => app.request(path, { method: "POST",
    headers: { "content-type": "application/json", "x-telegram-approval-token": secret }, body: JSON.stringify(body) });
  for (const action of ["preview", "confirm", "cancel"]) {
    assert.equal((await request(`/paper-sells/${id}/${action}`, { actor: "telegram:42", percent: 25 }, "wrong")).status, 403);
    assert.equal((await request(`/paper-sells/${id}/${action}`, { actor: "grok", percent: 25 })).status, 403);
    assert.equal((await request(`/paper-sells/${id}/${action}`, { actor: "telegram:43", percent: 25 })).status, 403);
    assert.equal((await request(`/paper-sells/bad/${action}`, { actor: "telegram:42" })).status, 400);
  }
  assert.equal((await request(`/paper-sells/${id}/preview`, { actor: "telegram:42", percent: 25.5 })).status, 400);
  assert.equal((await request(`/paper-sells/${id}/preview`, { actor: "telegram:42", percent: 25, quantity: "999" })).status, 400);
  for (const path of ["/positions", "/paper-balance", "/paper-sells/history"]) assert.equal((await app.request(path)).status, 503);
  assert.equal((await request(`/purchase-proposals/${id}/approve`, { actor: "telegram:42" })).status, 503);
  assert.equal((await request(`/paper-sells/${id}/confirm`, { actor: "telegram:42" })).status, 503);
});
