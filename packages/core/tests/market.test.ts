import assert from "node:assert/strict";
import { test } from "node:test";
import { captureEntry, fetchMarketQuote, marketPnl, NATIVE_ETH_ADDRESS, quoteUsable, selectMarketQuote } from "../src/market.js";
const token = `0x${"a".repeat(40)}`, now = new Date("2026-09-10T00:00:00Z");
const pool = (changes = {}) => ({ chainId: "robinhood", baseToken: { address: token.toUpperCase().replace("0X", "0x") }, quoteToken: { address: NATIVE_ETH_ADDRESS },
  pairAddress: `0x${"b".repeat(64)}`, priceNative: "0.0001", priceUsd: "0.25", liquidity: { usd: 50000, base: 100000, quote: 10 }, txns: { h1: { buys: 1, sells: 0 } }, ...changes });
test("exact chain/base token/native ETH validation rejects ticker copycats and USDG-denominated prices", () => {
  const quote = selectMarketQuote([pool()], token, now);
  assert.equal(quote.priceEth, 0.0001); assert.equal(quote.tokenAddress, token); assert.equal(quote.sourceUpdatedAt, null);
  for (const p of [pool({ chainId: "ethereum" }), pool({ baseToken: { address: `0x${"c".repeat(40)}`, symbol: "SAME" } }),
    pool({ quoteToken: { address: `0x${"d".repeat(40)}`, symbol: "ETH" } }), pool({ quoteToken: { address: token } }), pool({ priceUsd: "NaN" }),
    pool({ liquidity: { usd: 999, base: 100, quote: 1 } }), pool({ txns: { h1: { buys: 0, sells: 0 } } })]) {
    assert.throws(() => selectMarketQuote([p], token, now), /no_eligible_eth_pool/);
  }
});
test("choose deepest active eligible pool but abstain on significant conflicting prices", () => {
  const small = pool({ pairAddress: `0x${"c".repeat(40)}`, priceNative: "0.005", liquidity: { usd: 2000, base: 100, quote: 1 } });
  assert.equal(selectMarketQuote([small, pool()], token, now).priceEth, 0.0001);
  assert.throws(() => selectMarketQuote([pool(), { ...small, liquidity: { usd: 20000, base: 100, quote: 1 } }], token, now), /conflicting_pool_prices/);
});
test("entry snapshot locks price, currency and quantity; P&L uses the same cost currency", () => {
  const quote = selectMarketQuote([pool()], token, now);
  const eth = captureEntry(quote, token, "eth:0.05", now), usd = captureEntry(quote, token, "usd:100", now);
  assert.equal(eth.quantity, 500); assert.equal(usd.quantity, 400);
  const next = { ...quote, priceEth: 0.0002, priceUsd: 0.3 };
  assert.equal(marketPnl(eth, next, null, now.getTime())!.pnl, 0.05);
  assert.equal(marketPnl(usd, next, null, now.getTime())!.pnl, 20);
  assert.equal(eth.quote.priceEth, 0.0001);
});
test("stale, future, failed and cross-token observations never produce current P&L", () => {
  const quote = selectMarketQuote([pool()], token, now), entry = captureEntry(quote, token, "eth:0.05", now);
  assert.throws(() => captureEntry(quote, token, "eth:0.1", new Date(now.getTime() + 91000)), /fresh_entry_quote_required/);
  assert.equal(marketPnl(entry, quote, null, now.getTime() + 180001), null);
  assert.equal(marketPnl(entry, quote, "provider_rate_limited", now.getTime()), null);
  assert.equal(marketPnl(entry, { ...quote, tokenAddress: `0x${"f".repeat(40)}` }, null, now.getTime()), null);
  assert.equal(quoteUsable(quote, token, now.getTime() - 1), false);
});
test("provider transport is bounded and distinguishes rate limits", async () => {
  let url = "";
  const q = await fetchMarketQuote(token, async (input) => { url = String(input); return new Response(JSON.stringify([pool()])); });
  assert.equal(q.tokenAddress, token); assert.ok(url.endsWith(`/robinhood/${token}`));
  await assert.rejects(fetchMarketQuote(token, async () => new Response("", { status: 429 })), /provider_rate_limited/);
  await assert.rejects(fetchMarketQuote(token, async () => new Response("x".repeat(1000001))), /provider_response_too_large/);
});
