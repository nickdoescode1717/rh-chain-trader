import type { ApiClient, PaperFill, SellAction, SellPreview } from "./api.js";
import type { FormattedMessage } from "./format.js";
import { amount } from "./portfolio.js";
const button = (text: string, callback_data: string) => ({ text, callback_data });
const back = [[button("Positions", "portfolio:positions:0"), button("Balance", "portfolio:balance")], [button("Trade history", "paper:history:0")]];
export const modelNote = "Standard paper exits: 0.3% fee + 0.5% adverse slippage. Pons route exits use current verified curve reserves, base fee and creator tax; exit gas is excluded. Policy-v2 entries charge their full approved entry gas allowance.";
export function formatSellPreview(p: SellPreview): FormattedMessage {
  const route=p.preview.model?.version==="pons-route-paper-sell-v1";
  return { text: ["🧾 CONFIRM PAPER SELL", "", `${p.percent}% of remaining tokens`, `Quantity  ${amount(p.preview.quantity)}`,
    `Estimated net proceeds  ${amount(p.preview.cashDelta)} ${p.currency}`, `Modeled fee  ${amount(p.preview.fee)} ${p.currency}`,
    `Estimated realized P&L  ${amount(p.preview.realizedPnl, true)} ${p.currency}`, `Minimum net  ${amount(p.minimumNet)} ${p.currency}`,
    ...(route?["Pricing  Exact Pons V2 curve reserves + reserve impact"]:[]),"", "Contract · chain 4663", p.tokenCA, "", `Expires  ${p.expiresAt}`, "Confirmation requests a fresh route quote and rechecks remaining holdings.",
    modelNote, "Paper only; no real transaction."].join("\n"), reply_markup: { inline_keyboard: [
      [button("Confirm paper sell", `paper:confirm:${p.id}`)], [button("Cancel", `paper:cancel:${p.id}`)]] } };
}
function queued(result:SellAction):result is Extract<SellAction,{queued:true}>{return "queued" in result&&result.queued===true;}
function receipt(result:SellAction):result is Extract<SellAction,{fill:PaperFill}>{return "fill" in result;}
function formatQueued(r:Extract<SellAction,{queued:true}>):FormattedMessage{
  const id=r.id??r.intent?.id??"";
  const quote=r.phase==="quote";
  return {text:[quote?"⏳ PONS EXIT QUOTE QUEUED":"⏳ PAPER SELL RECHECK QUEUED","",quote?"The collector is reading the verified curve's current reserves and fee terms.":"Your Telegram approval is recorded. The collector is rechecking the route against current reserves before settlement.",
    "No real transaction will be sent.","","Route checks run only while collection and chain scanning are on. Use /run and /chainon if you intentionally paused them."].join("\n"),
    reply_markup:{inline_keyboard:[[button(quote?"Check route quote":"Check settlement",quote?`paper:status:${id}`:`paper:confirm:${id}`)],[button("Cancel",`paper:cancel:${id}`)]]}};
}
export function formatSellReceipt(fill: PaperFill, replayed = false): FormattedMessage {
  const x = fill.execution;
  return { text: [replayed ? "✅ PAPER SELL · ALREADY RECORDED" : "✅ PAPER SELL RECORDED", "", `Sold  ${amount(x.quantity)} tokens`,
    `Net proceeds  ${amount(x.cashDelta)} ${fill.currency}`, `Realized P&L  ${amount(x.realizedPnl, true)} ${fill.currency}`,
    `Fee  ${amount(x.fee)} ${fill.currency}`, `Remaining  ${amount(x.remainingQuantity)} tokens`,
    "", fill.quote.tokenAddress, `Fill  ${fill.id}`, "Use Balance for updated cash.", modelNote].join("\n"), reply_markup: { inline_keyboard: back } };
}
export function formatHistory(fills: PaperFill[], requestedPage = 0): FormattedMessage {
  const pages = Math.max(1, Math.ceil(fills.length / 5)), page = Math.min(Math.max(0, requestedPage), pages - 1);
  const text = ["📒 TRADE HISTORY · PAPER", `Latest ${fills.length} fills · Page ${page + 1}/${pages}`, "",
    ...fills.slice(page * 5, page * 5 + 5).flatMap(f => [
      `${f.side.toUpperCase()} · ${f.createdAt.slice(0,16).replace("T", " ")} UTC`,
      f.quote.tokenAddress, `Quantity  ${amount(f.execution.quantity)}`, `Cash ${amount(f.execution.cashDelta, true)} ${f.currency}`,
      ...(f.execution.model?.version === "pons-route-paper-v1" ? [`Route entry · fee/tax ${amount(f.execution.fee)} ETH · gas allowance ${amount(f.execution.gasAllowance)} ETH`] : []),
      ...(f.execution.model?.version === "pons-route-paper-sell-v1" ? [`Route exit · exact curve reserves · fee/tax ${amount(f.execution.fee)} ETH · exit gas excluded`] : []),
      ...(f.side === "sell" ? [`Realized P&L  ${amount(f.execution.realizedPnl, true)} ${f.currency}`] : []), ""]),
    ...(fills.length ? [] : ["No ledger fills yet. Older holdings remain visible in Positions."]), modelNote];
  return { text: text.join("\n"), reply_markup: { inline_keyboard: [[
    ...(page ? [button("‹ Previous", `paper:history:${page - 1}`)] : []), button("Refresh", `paper:history:${page}`),
    ...(page + 1 < pages ? [button("Next ›", `paper:history:${page + 1}`)] : [])], back[0]] } };
}
export async function handlePaperCallback(api: Pick<ApiClient, "previewPaperSell" | "getPaperSell" | "confirmPaperSell" | "cancelPaperSell" | "listPaperFills">, data: string, actor: string): Promise<FormattedMessage> {
  const match = /^paper:(preview):(25|50|100):([0-9a-f-]{36})$/i.exec(data);
  const decision = /^paper:(confirm|cancel):([0-9a-f-]{36})$/i.exec(data);
  const status=/^paper:status:([0-9a-f-]{36})$/i.exec(data);
  const history = /^paper:history:(\d{1,6})$/.exec(data);
  try {
    if (history) return formatHistory(await api.listPaperFills(), Number(history[1]));
    if(match){const r=await api.previewPaperSell(match[3],Number(match[2]),actor);return queued(r)?formatQueued(r):receipt(r)?formatSellReceipt(r.fill,r.replayed):formatSellPreview(r);}
    if(status){const r=await api.getPaperSell(status[1],actor);return queued(r)?formatQueued(r):receipt(r)?formatSellReceipt(r.fill,r.replayed):formatSellPreview(r);}
    if (decision?.[1] === "confirm") { const r = await api.confirmPaperSell(decision[2], actor); return queued(r)?formatQueued(r):receipt(r)?formatSellReceipt(r.fill,r.replayed):formatSellPreview(r); }
    if (decision?.[1] === "cancel") { await api.cancelPaperSell(decision[2], actor); return { text: "Paper sell cancelled.", reply_markup: { inline_keyboard: back } }; }
    return { text: "Unknown paper action. Open /positions again." };
  } catch (e) {
    const explanations: Record<string, string> = {
      fresh_entry_quote_required: "A fresh, eligible market quote is required. Try again after the next price update.",
      legacy_entry_quantity_missing: "This older holding has no trustworthy recorded quantity. Its paper sell is blocked.",
      sell_preview_expired: "This preview expired or was cancelled. Open a new sell preview.",
      position_changed_refresh_preview: "The holding changed after this preview. Refresh Positions and preview again.",
      price_moved_refresh_preview: "The estimated proceeds fell below the confirmed minimum. Preview the new price.",
      sell_already_executed: "This sell already executed. Check History and Balance.",
      position_closed: "This position is already closed.",
      route_sell_request_expired:"The route check was not completed within five minutes. Open a new sell preview.",
      route_sell_position_changed:"The holding or its verified route changed. Refresh Positions and open a new preview.",
      route_sell_report_invalid:"The route result failed settlement validation. Open a new preview.",
      collection_disabled:"Collection or chain scanning was switched off before the quote completed. Use /run and /chainon, then open a new preview.",
      provider_simulation_unavailable:"The chain provider could not produce a trustworthy route quote. Retry from Positions later.",
      unsupported_graduated_route:"This token has graduated from the supported Pons curve. A V4 exit adapter is not implemented yet.",
      insufficient_real_quote_reserve:"The curve does not currently hold enough real quote liquidity for this sell.",
      route_checks_busy:"Three route checks were requested recently. Wait five minutes before opening another route sell preview.",
    };
    const reason = e instanceof Error ? explanations[e.message] : null;
    // An HTTP timeout can follow a committed fill. Keep the same intent ID for a safe retry.
    return { text: reason ?? "The result could not be confirmed. Check History, or retry this same confirmation; it cannot create a second fill.",
      reply_markup: { inline_keyboard: [...(!reason && decision?.[1] === "confirm" ? [[button("Retry same confirmation", data)]] : []), ...back] } };
  }
}
