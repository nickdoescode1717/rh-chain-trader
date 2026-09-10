import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient, type SellPreview, type PaperFill } from "../src/api.js";
import { formatSellPreview, formatSellReceipt, handlePaperCallback } from "../src/paper-trading.js";
const id = "11111111-1111-4111-8111-111111111111";
const preview: SellPreview = { id, positionId: id, tokenCA: `0x${"a".repeat(40)}`, percent: 25, currency: "ETH", minimumNet: "0.09", expiresAt: new Date().toISOString(),
  preview: { mode: "paper", side: "sell", quantity: "100", fee: "0.001", cashDelta: "0.1", executionPrice: "0.001", cost: "0.05", realizedPnl: "0.05" } };
test("preview never executes; only explicit confirmation settles, and an uncertain result retains its original intent", async () => {
  let confirms = 0, cancels = 0;
  const api = { previewPaperSell: async () => preview, confirmPaperSell: async () => { confirms++; throw new Error("timeout secret"); },
    cancelPaperSell: async () => { cancels++; return { cancelled: true }; }, listPaperFills: async () => [] };
  const card = await handlePaperCallback(api, `paper:preview:25:${id}`, "telegram:42");
  assert.match(card.text, /Minimum net/); assert.ok(card.text.includes(preview.tokenCA)); assert.equal(confirms, 0);
  const failed = await handlePaperCallback(api, `paper:confirm:${id}`, "telegram:42");
  assert.equal(confirms, 1); assert.doesNotMatch(failed.text, /secret/);
  assert.ok(failed.reply_markup!.inline_keyboard.flat().some(b => b.callback_data === `paper:confirm:${id}`));
  await handlePaperCallback(api, `paper:cancel:${id}`, "telegram:42"); assert.equal(cancels, 1);
  for (const button of formatSellPreview(preview).reply_markup!.inline_keyboard.flat()) assert.ok(Buffer.byteLength(button.callback_data) <= 64);
  const fill: PaperFill = { id, positionId: id, currency: "ETH", side: "sell", execution: { ...preview.preview, remainingQuantity: "0" }, createdAt: new Date().toISOString(), quote: { tokenAddress: preview.tokenCA } };
  assert.match(formatSellReceipt(fill, true).text, /ALREADY RECORDED/); assert.match(formatSellReceipt(fill).text, /Realized P&L  \+0.05 ETH/);
});
test("sell API credentials go only to decision routes; actor and percent are preserved", async () => {
  const original = globalThis.fetch, calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ data: preview })); };
  try {
    const api = createApiClient("http://localhost", "test-secret-".repeat(4));
    await api.previewPaperSell(id, 50, "telegram:42"); await api.confirmPaperSell(id, "telegram:42"); await api.listPaperFills();
    assert.equal((calls[0].init!.headers as Record<string,string>)["x-telegram-approval-token"], "test-secret-".repeat(4));
    assert.deepEqual(JSON.parse(calls[0].init!.body as string), { percent: 50, actor: "telegram:42" });
    assert.equal((calls[2].init!.headers as Record<string,string>)["x-telegram-approval-token"], undefined);
  } finally { globalThis.fetch = original; }
});
