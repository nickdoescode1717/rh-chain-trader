import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { Hono } from "hono";
import { purchaseProposalRoutes } from "../src/routes/purchase-proposals.js";
import { positionRoutes } from "../src/routes/positions.js";
import { paperBalanceRoutes } from "../src/routes/paper-balance.js";
import { memPurchaseProposals } from "../src/purchase-proposals-mem.js";
import { memPaperPositions } from "../src/paper-positions-mem.js";

const app = new Hono();
app.route("/purchase-proposals", purchaseProposalRoutes);
app.route("/positions", positionRoutes);
app.route("/paper-balance", paperBalanceRoutes);
const tokenCA = `0x${"1".repeat(40)}`;
const originalCash = process.env.PAPER_CASH_ETH;
const testApprovalToken = "test-only-telegram-service-secret-0000000000000000";
const originalApprovalEnv = Object.fromEntries(["TELEGRAM_APPROVAL_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_OWNER_USER_ID"].map((key) => [key, process.env[key]]));
afterEach(() => {
  if (originalCash === undefined) delete process.env.PAPER_CASH_ETH;
  else process.env.PAPER_CASH_ETH = originalCash;
  for (const [key, value] of Object.entries(originalApprovalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const post = (path: string, body: unknown) => app.request(path, {
  method: "POST", headers: { "content-type": "application/json",
    ...(/\/(approve|reject)$/.test(path) ? { "x-telegram-approval-token": testApprovalToken } : {}) },
  body: JSON.stringify(/\/(approve|reject)$/.test(path) && body && typeof body === "object" && !Array.isArray(body) ? { actor: "telegram:42", ...body } : body),
});

beforeEach(() => {
  memPurchaseProposals.length = 0;
  memPaperPositions.length = 0;
  process.env.PAPER_CASH_ETH = "1";
  process.env.TELEGRAM_APPROVAL_TOKEN = testApprovalToken;
  process.env.TELEGRAM_CHAT_ID = "42";
  process.env.TELEGRAM_OWNER_USER_ID = "42";
});

test("Grok, wrong owners and forged Telegram labels cannot approve or reject proposals", async () => {
  const created = await post("/purchase-proposals", { tokenCA, sizeEth: 0.1, scores: { identityVerified: true } });
  const { data } = await created.json();
  assert.equal(data.approvalChannel, "telegram_only"); assert.equal(data.issuerIdentity.status, "unverified");
  for (const action of ["approve", "reject"]) {
    const url = `/purchase-proposals/${data.id}/${action}`;
    for (const [token, actor] of [[undefined, "telegram:42"], ["wrong-secret", "telegram:42"], [testApprovalToken, "grok"], [testApprovalToken, "telegram:43"]]) {
      const response = await app.request(url, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-telegram-approval-token": token } : {}) }, body: JSON.stringify({ actor }) });
      assert.equal(response.status, 403); assert.equal(memPurchaseProposals[0].status, "pending_nick"); assert.equal(memPaperPositions.length, 0);
    }
  }
  delete process.env.TELEGRAM_APPROVAL_TOKEN;
  assert.equal((await post(`/purchase-proposals/${data.id}/approve`, {})).status, 503);
  assert.equal(memPurchaseProposals[0].status, "pending_nick");
});

test("rejects invalid and ambiguous proposal amounts without creating a proposal", async () => {
  for (const size of [
    { sizeEth: -1 }, { sizeEth: 0 }, { sizeEth: "NaN" },
    { sizeEth: "Infinity" }, { sizeEth: true }, { sizeEth: {} },
    { sizeEth: " " }, { sizeEth: "0x10" },
    { sizeEth: 1, sizeUsd: 10 }, { size: "eth:1", sizeEth: 1 },
    { size: "eth:-1" }, { size: "whatever" }, { size: 5 },
  ]) {
    assert.equal((await post("/purchase-proposals", { tokenCA, ...size })).status, 400, JSON.stringify(size));
  }
  assert.equal(memPurchaseProposals.length, 0);
});

test("accepts positive ETH and USD amounts with explicit units", async () => {
  for (const [size, expected] of [
    [{ sizeEth: "0.05" }, "eth:0.05"],
    [{ sizeUsd: 20 }, "usd:20"],
    [{ size: "eth:0.1" }, "eth:0.1"],
  ] as const) {
    const response = await post("/purchase-proposals", { tokenCA, ...size });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).data.size, expected);
  }
});

test("malformed proposal bodies and slippage return 400 instead of 500", async () => {
  for (const body of [null, [], 123, "bad", { tokenCA: 42, sizeEth: 1 },
    { tokenCA, sizeEth: 1, slippageBps: 1.5 },
    { tokenCA, sizeEth: 1, slippageBps: 10001 },
    { tokenCA, sizeEth: 1, slippageBps: true },
  ]) assert.equal((await post("/purchase-proposals", body)).status, 400);
});

async function openPosition(scores: unknown = { entryPrice: "2" }, size = "eth:0.2") {
  const created = await post("/purchase-proposals", { tokenCA, size, scores });
  assert.equal(created.status, 201);
  const { data } = await created.json();
  const approved = await post(`/purchase-proposals/${data.id}/approve`, {});
  assert.equal(approved.status, 200);
  const result = await approved.json();
  assert.equal(result.signed, false);
  assert.equal(result.txSubmitted, false);
  assert.equal(result.paperOnly, true);
  assert.equal((await post(`/purchase-proposals/${data.id}/approve`, {})).status, 409);
  return result.position.id as string;
}

test("manual marks preserve position value and flow into equity", async () => {
  const id = await openPosition();
  for (const [mark, value, equity] of [["4", "0.4", "1.2"], ["1", "0.1", "0.9"], ["0", "0", "0.8"]]) {
    assert.equal((await post(`/positions/${id}/paper-mark`, { mark })).status, 200);
    const { data } = await (await app.request("/paper-balance")).json();
    assert.equal(data.cashEth, "0.8");
    assert.equal(data.totals.positionsEth, value);
    assert.equal(data.equityEth, equity);
  }
});

test("invalid marks leave the previous mark unchanged", async () => {
  const id = await openPosition();
  for (const body of [null, [], 2, { mark: "NaN" }, { mark: "Infinity" },
    { mark: "-1" }, { mark: true }, { mark: {} }, { mark: "0x10" }]) {
    assert.equal((await post(`/positions/${id}/paper-mark`, body)).status, 400);
    assert.equal(memPaperPositions[0].currentPrice, "2");
  }
});

test("unknown ETH marks retain cost basis with an incomplete valuation flag", async () => {
  await openPosition(null);
  const { data } = await (await app.request("/paper-balance")).json();
  assert.equal(data.equityEth, "1");
  assert.equal(data.valuationComplete, false);
  assert.equal(data.positions[0].unrealizedEth, null);
});

test("zero starting cash remains zero", async () => {
  process.env.PAPER_CASH_ETH = "0";
  const { data } = await (await app.request("/paper-balance")).json();
  assert.equal(data.cashEth, "0");
});

test("USD positions do not invent ETH PnL or claim complete valuation", async () => {
  const id = await openPosition({ entryPrice: "2" }, "usd:20");
  await post(`/positions/${id}/paper-mark`, { mark: "4" });
  const { data } = await (await app.request("/paper-balance")).json();
  assert.equal(data.valuationComplete, false);
  assert.equal(data.positions[0].unrealizedPct, 100);
  assert.equal(data.positions[0].unrealizedEth, null);
  assert.equal(memPaperPositions[0].pnlAbs, null);
});

test("invalid entry estimates stay unknown", async () => {
  await openPosition({ entryPrice: "not-a-price" });
  assert.equal(memPaperPositions[0].entryPrice, null);
  assert.equal(memPaperPositions[0].markSource, "oracle_pending");
});

test("invalid decision bodies do not approve, reject, or open a position", async () => {
  const response = await post("/purchase-proposals", { tokenCA, sizeEth: 0.1 });
  const { data } = await response.json();
  for (const action of ["approve", "reject"]) {
    for (const body of [null, [], 2, { actor: {} }]) {
      assert.equal((await post(`/purchase-proposals/${data.id}/${action}`, body)).status, 400);
      assert.equal(memPurchaseProposals[0].status, "pending_nick");
      assert.equal(memPaperPositions.length, 0);
    }
  }
});

test("expired proposals cannot open positions", async () => {
  const response = await post("/purchase-proposals", {
    tokenCA, sizeEth: 0.1, expiresAt: "2000-01-01T00:00:00Z",
  });
  const { data } = await response.json();
  assert.equal((await post(`/purchase-proposals/${data.id}/approve`, {})).status, 409);
  assert.equal(memPurchaseProposals[0].status, "expired");
  assert.equal(memPaperPositions.length, 0);
});
