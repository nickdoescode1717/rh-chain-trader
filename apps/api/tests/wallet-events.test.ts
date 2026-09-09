import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { walletEventRoutes } from "../src/routes/wallet-events.js";
import { memWalletEvents } from "../src/memory-store.js";

test("wallet observations cannot be mistaken for verified buys", async () => {
  const app = new Hono().route("/wallet-events", walletEventRoutes);
  memWalletEvents.push({ leadSource: "watched_wallet", wallet: `0x${"1".repeat(40)}`,
    walletLabel: "test", token: `0x${"2".repeat(40)}`, tokenSymbol: "TEST",
    amount: "100", amountUsd: null, txHash: null, block: 1, entryEstimate: null,
    otherWatchedOnToken: [], observedAt: new Date().toISOString() });
  try {
    const response = await app.request("/wallet-events");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data[0].eventType, "unclassified");
    assert.equal(data[0].buyVerified, false);
    assert.equal(data[0].entryEstimate, null);
  } finally { memWalletEvents.length = 0; }
});
