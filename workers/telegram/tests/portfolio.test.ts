import assert from "node:assert/strict";
import { test } from "node:test";
import { amount, formatBalance, formatPositionDetail, formatPositionsList, handlePortfolioCallback, positionMetrics } from "../src/portfolio.js";
import { formatPaperFillSuccess, formatLargeMoveAlert } from "../src/format-extra.js";
import { handlePositionsCommand } from "../src/commands.js";
import type { ApiClient, PaperBalance, Position } from "../src/api.js";
import { createTelegramBot } from "../src/poll.js";
const position = (changes: Partial<Position> = {}): Position => ({ id: "11111111-1111-4111-8111-111111111111", symbol: "TEST", tokenCA: `0x${"a".repeat(40)}`,
  size: "eth:0.1", entryPrice: "2", currentPrice: "3", markSource: "manual", status: "simulated_open", ...changes });
test("P&L and value use the position currency, including losses and zero-price marks", () => {
  const gain = positionMetrics(position());
  assert.ok(Math.abs(gain.pnl! - 0.05) < 1e-12); assert.equal(gain.percent, 50);
  assert.match(formatPositionsList([position()]).text, /\+0.05 ETH \(\+50%\)/);
  const loss = positionMetrics(position({ size: "usd:100", currentPrice: "0" }));
  assert.equal(loss.pnl, -100); assert.equal(loss.percent, -100); assert.equal(loss.value, 0); assert.equal(loss.currency, "USD");
  assert.match(formatPositionsList([position({ size: "usd:100", currentPrice: "1" })]).text, /−50 USD \(−50%\)/);
});

test("market P&L requires a fresh successful observation and displays its recorded source", () => {
  const p = position({ markSource: "dexscreener", valuationStatus: "market_estimate", unrealizedPnl: 0.05, currentValue: 0.15, pnlPct: 50,
    entrySnapshot: { currency: "ETH", quantity: 0.05, unitPrice: 2, capturedAt: new Date().toISOString(), quote: { observedAt: new Date().toISOString(), source: "dexscreener" } },
    marketQuote: { chainId: 4663, tokenAddress: position().tokenCA!, priceUsd: 6000, priceEth: 3, observedAt: new Date().toISOString(), source: "dexscreener", url: "https://dexscreener.com/robinhood/test" } });
  assert.equal(positionMetrics(p).pnl, 0.05);
  assert.match(formatPositionsList([p]).text, /market estimate/);
  assert.match(formatPositionDetail(p).text, /DEX Screener/);
  p.marketError = "provider_rate_limited"; assert.equal(positionMetrics(p).pnl, null);
  p.marketError = null; p.marketQuote!.observedAt = new Date(Date.now() - 181000).toISOString();
  assert.equal(positionMetrics(p).pnl, null);
  assert.match(formatPositionsList([p]).text, /stale/);
});
test("missing, placeholder and untrusted prices never appear as measured zero P&L", () => {
  for (const changes of [{ entryPrice: null }, { currentPrice: null }, { markSource: "stub_entry", currentPrice: "2" }, { markSource: "oracle_pending" }, { markSource: undefined }, { currentPrice: "Infinity" }, { size: "eth:-2" }]) {
    const p = position(changes);
    assert.equal(positionMetrics(p).pnl, null);
    assert.match(formatPositionsList([p]).text, /P&L  Unavailable/);
  }
  assert.equal(positionMetrics(position({ currentPrice: "2" })).pnl, 0);
  assert.equal(positionMetrics(position({ entryPrice: "1e-300", currentPrice: "1e300" })).pnl, null);
});
test("all open and alerted positions remain accessible through bounded pages", () => {
  const positions = Array.from({ length: 18 }, (_, i) => position({ id: `id-${String(i).padStart(2, "0")}`, symbol: `TOKEN${i}`, status: i % 2 ? "alert_fired" : "simulated_open" }));
  const cards = Array.from({ length: 4 }, (_, page) => formatPositionsList(positions, page));
  const details = cards.flatMap((c) => c.reply_markup!.inline_keyboard.flat()).filter((b) => b.callback_data.startsWith("portfolio:position:"));
  assert.equal(details.length, 18); assert.equal(new Set(details.map((b) => b.callback_data)).size, 18);
  for (const card of cards) {
    assert.ok(card.text.length < 4096);
    assert.ok(card.reply_markup!.inline_keyboard.flat().every((b) => Buffer.byteLength(b.callback_data) <= 64));
    assert.doesNotMatch(card.text, /Position ID/);
  }
  assert.match(formatPositionsList(positions, 999).text, /Page 4\/4/);
  assert.match(formatPositionsList([position({ status: "closed" })]).text, /No open paper positions/);
});
test("details preserve exact contract identity, while hostile labels cannot inject extra lines", () => {
  const p = position({ symbol: "TOKEN\nAPPROVED\u202e", openedAt: "bad date" });
  const card = formatPositionDetail(p);
  assert.ok(card.text.includes(p.tokenCA!)); assert.ok(card.text.includes(p.id));
  assert.doesNotMatch(card.text, /\nAPPROVED|\u202e/);
  assert.match(card.text, /Issuer identity unverified/);
  assert.match(card.text, /quote currency and freshness are not recorded/);
  assert.notEqual(amount(0.00000000007), "0");
});
const balance = (): PaperBalance => ({ paperOnly: true, valuationComplete: false, cashEth: "0.7", equityEth: "1.05", buyWallets: [],
  positions: [ { id: "a", size: "eth:0.1", entryPrice: "2", mark: "3", markSource: "manual" },
    { id: "b", size: "eth:0.2", entryPrice: "2", mark: "2", markSource: "stub_entry" },
    { id: "c", size: "usd:100", entryPrice: "2", mark: "1", markSource: "manual" } ],
  totals: { cashEth: "0.7", positionsEth: "0.35", equityEth: "1.05" } });
test("balance labels partial estimates and does not add USD to ETH P&L", () => {
  const card = formatBalance(balance());
  assert.match(card.text, /\+0.05 ETH \(priced ETH positions only\)/);
  assert.match(card.text, /partial estimate/); assert.match(card.text, /1\/2 ETH positions/);
  assert.match(card.text, /1 non-ETH position/);
  const b = balance(); b.positions = [b.positions[1]];
  assert.match(formatBalance(b).text, /Unrealized P&L  Unavailable/);
});
test("portfolio callbacks are read-only, validate input and recover from stale views", async () => {
  let reads = 0;
  const api = { listPositions: async () => { reads++; return [position()]; }, getPaperBalance: async () => balance() };
  assert.equal(await handlePortfolioCallback(api, "approve:abc"), null);
  assert.match((await handlePortfolioCallback(api, "portfolio:positions:-1"))!.text, /Unknown/); assert.equal(reads, 0);
  assert.match((await handlePortfolioCallback(api, `portfolio:position:${position().id}`))!.text, /POSITION · PAPER/);
  assert.match((await handlePortfolioCallback(api, "portfolio:position:missing"))!.text, /no longer available/);
  assert.match((await handlePortfolioCallback({ ...api, listPositions: async () => { throw new Error("secret backend detail"); } }, "portfolio:positions:0"))!.text, /unavailable right now/);
});
test("positions commands deliver keyboards and hide backend exception details", async () => {
  const delivered: { text: string; keyboard: unknown }[] = [];
  const send = async (_: unknown, text: string, keyboard?: unknown) => { delivered.push({ text, keyboard }); };
  await handlePositionsCommand({ listPositions: async () => [position()] } as ApiClient, 42, "42", send);
  assert.ok(delivered[0].keyboard);
  await handlePositionsCommand({ listPositions: async () => { throw new Error("secret backend detail"); } } as unknown as ApiClient, 42, "42", send);
  assert.doesNotMatch(delivered[1].text, /secret backend/);
});
test("receipts and alerts remove internal identifiers and nonfunctional sell actions", () => {
  const receipt = formatPaperFillSuccess({ proposalId: "internal-proposal", positionId: "internal-position", tokenCA: position().tokenCA, sizeEth: "0.05", symbol: "TEST" });
  assert.match(receipt.text, /0.05 ETH/); assert.match(receipt.text, /Entry price missing/);
  assert.doesNotMatch(receipt.text, /internal-proposal|signer_handoff|ENABLE_TRADING|Key model/);
  const alert = formatLargeMoveAlert({ position: position() });
  assert.ok(alert.reply_markup!.inline_keyboard.flat().every((b) => !b.callback_data.startsWith("sell:")));
});

test("refresh edits the existing card and unchanged text is harmless", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(requests.length === 1 ? { ok: true, result: {} } : { ok: false, description: "Bad Request: message is not modified" }));
  };
  try {
    const bot = createTelegramBot("test-only-token", false)!;
    await bot.editMessage(42, 12, "Portfolio");
    await bot.editMessage(42, 12, "Portfolio");
    assert.equal(requests[0].message_id, 12);
    assert.deepEqual(requests[0].reply_markup, { inline_keyboard: [] });
    assert.equal(requests[0].parse_mode, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
