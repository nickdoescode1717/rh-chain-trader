import type { ApiClient, PaperBalance, Position } from "./api.js";
import type { FormattedMessage } from "./format.js";
const clean = (v: unknown, max = 45) => String(v ?? "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, max);
const number = (v: unknown): number | null => {
  if (v == null || v === "" || (typeof v !== "string" && typeof v !== "number")) return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
};
export function amount(v: unknown, signed = false): string {
  const n = number(v); if (n == null) return "—";
  const abs = Math.abs(n);
  const text = abs !== 0 && abs < 0.000001 ? abs.toExponential(3) : abs.toLocaleString("en-US", { maximumSignificantDigits: 6 });
  return `${n < 0 ? "−" : signed && n > 0 ? "+" : ""}${text}`;
}
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const shortAddress = (p: Position) => {
  const a = clean(p.tokenCA ?? p.tokenAddress, 42);
  return /^0x[a-fA-F0-9]{40}$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "address unavailable";
};
const label = (p: Position) => p.symbol ? `$${clean(p.symbol).replace(/^\$/, "")}` : "Unnamed token";
const openPositions = (positions: Position[]) => positions.filter((p) => p.status === "simulated_open" || p.status === "alert_fired")
  .sort((a, b) => String(b.openedAt ?? "").localeCompare(String(a.openedAt ?? "")) || a.id.localeCompare(b.id));
const button = (text: string, callback_data: string) => ({ text, callback_data });

/** Placeholder entry prices never count as current market prices. */
export function positionMetrics(p: Position) {
  const match = /^(eth|usd):(.+)$/.exec(p.size ?? "");
  const cost = match ? number(match[2]) : null, currency = match?.[1].toUpperCase() ?? "";
  const entry = number(p.entryPrice), mark = number(p.currentPrice);
  let reason: string | null = null;
  if (entry == null || entry <= 0) reason = "entry price missing";
  else if (p.markSource === "stub_entry") reason = "placeholder price; awaiting market data";
  else if (mark == null || mark < 0 || p.markSource === "oracle_pending") reason = "current price missing";
  else if (p.markSource !== "manual") reason = "price source unverified";
  else if (cost == null || cost <= 0) reason = "position size unavailable";
  const change = reason == null ? mark! / entry! - 1 : null;
  const pnl = change == null ? null : cost! * change;
  if (pnl != null && (!Number.isFinite(pnl) || !Number.isFinite(change! * 100) || !Number.isFinite(cost! + pnl))) reason = "price calculation unavailable";
  return { cost, currency, entry, mark, reason, pnl: reason == null ? pnl : null,
    percent: reason == null ? change! * 100 : null, value: reason == null ? cost! + pnl! : null };
}
function positionLines(p: Position, index?: number): string[] {
  const m = positionMetrics(p);
  return [`${index == null ? "" : `${index}. `}${label(p)} · ${shortAddress(p)}`, `Invested  ${amount(m.cost)} ${m.currency}`,
    ...(m.reason ? [`P&L  Unavailable — ${m.reason}`] : [
      `${m.pnl! >= 0 ? "🟢" : "🔴"} P&L  ${amount(m.pnl, true)} ${m.currency} (${pct(m.percent!)})`,
      `Value  ${amount(m.value)} ${m.currency} · recorded manual price`])];
}
export function formatPositionsList(positions: Position[], requestedPage = 0): FormattedMessage {
  const open = openPositions(positions), pages = Math.max(1, Math.ceil(open.length / 5));
  const page = Math.min(Math.max(0, Number.isSafeInteger(requestedPage) ? requestedPage : 0), pages - 1);
  const visible = open.slice(page * 5, (page + 1) * 5);
  const lines = ["📊 POSITIONS · PAPER", `${open.length} open${pages > 1 ? ` · Page ${page + 1}/${pages}` : ""}`, ""];
  if (!open.length) lines.push("No open paper positions.", "Approved paper proposals will appear here.");
  visible.forEach((p, i) => lines.push(...positionLines(p, page * 5 + i + 1), ""));
  lines.push("P&L is unrealized, before fees. No live price feed.", "Tap a position for its full address and price details.");
  const nav = [...(page > 0 ? [button("‹ Previous", `portfolio:positions:${page - 1}`)] : []), button("Refresh", `portfolio:positions:${page}`),
    ...(page + 1 < pages ? [button("Next ›", `portfolio:positions:${page + 1}`)] : [])];
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: [
    ...visible.filter((p) => /^[a-zA-Z0-9-]{1,40}$/.test(p.id)).map((p) => [button(`${label(p)} · ${shortAddress(p)}`, `portfolio:position:${p.id}`)]),
    nav, [button("Balance", "portfolio:balance"), button("Projects", "research:list:0")]] } };
}
export function formatPositionDetail(p: Position): FormattedMessage {
  const m = positionMetrics(p), date = p.openedAt ? new Date(p.openedAt) : null;
  return { text: ["📋 POSITION · PAPER", "", ...positionLines(p), "", `Entry price  ${amount(m.entry)}`, `Recorded price  ${amount(m.mark)}`,
    "Price quote currency and freshness are not recorded.", "No live price feed; manual marks are estimates, before fees.",
    date && Number.isFinite(date.getTime()) ? `Opened  ${date.toISOString().slice(0, 16).replace("T", " ")} UTC` : "Opened  unknown", "",
    `Contract · chain ${p.chainId ?? 4663}`, clean(p.tokenCA ?? p.tokenAddress, 42), "Issuer identity unverified.", "",
    `Position ID  ${clean(p.id, 40)}`, "Selling is not connected yet.",
  ].join("\n"), reply_markup: { inline_keyboard: [[button("‹ Positions", "portfolio:positions:0"), button("Balance", "portfolio:balance")]] } };
}
export function formatBalance(b: PaperBalance): FormattedMessage {
  const tracked = b.positions.map((p) => ({ ...p, currentPrice: p.mark, status: "simulated_open" }));
  const eth = tracked.filter((p) => p.size?.startsWith("eth:")), metrics = eth.map(positionMetrics), priced = metrics.filter((p) => p.pnl != null);
  const missing = metrics.length - priced.length, other = tracked.length - eth.length;
  const partial = missing > 0 || other > 0 || b.valuationComplete === false;
  const pnl = priced.reduce((sum, p) => sum + p.pnl!, 0);
  const lines = ["💰 BALANCE · PAPER", "", `Available cash  ${amount(b.cashEth)} ETH`,
    `Positions  ${amount(b.totals.positionsEth)} ETH${partial ? " (partial estimate)" : " (recorded marks)"}`,
    `Total equity  ${amount(b.equityEth)} ETH${partial ? " (partial estimate)" : ""}`, "", `Open positions  ${tracked.length}`,
    priced.length ? `Unrealized P&L  ${amount(pnl, true)} ETH${missing || other ? " (priced ETH positions only)" : ""}` : tracked.length ? "Unrealized P&L  Unavailable — prices missing or placeholders" : "Unrealized P&L  0 ETH · no open positions",
    `${priced.length}/${eth.length} ETH positions have usable recorded marks.`,
    ...(missing ? ["Unpriced ETH positions are held at cost in the equity estimate."] : []),
    ...(other ? [`${other} non-ETH position(s) excluded from ETH totals; conversion unavailable.`] : []),
    "", "Paper estimates, before fees. No live price feed.", "Real wallet funds and watched traders are not included."];
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: [[button("Positions", "portfolio:positions:0"), button("Refresh", "portfolio:balance")], [button("Projects", "research:list:0")]] } };
}
export async function handlePortfolioCallback(api: Pick<ApiClient, "listPositions" | "getPaperBalance">, data: string): Promise<FormattedMessage | null> {
  if (!data.startsWith("portfolio:")) return null;
  try {
    if (data === "portfolio:balance") return formatBalance(await api.getPaperBalance());
    const page = /^portfolio:positions:(\d{1,6})$/.exec(data), detail = /^portfolio:position:([a-zA-Z0-9-]{1,40})$/.exec(data);
    if (!page && !detail) return { text: "Unknown portfolio action. Use /positions." };
    const positions = await api.listPositions(); if (!positions) throw new Error("positions_unavailable");
    if (page) return formatPositionsList(positions, Number(page[1]));
    const position = positions.find((p) => p.id === detail![1]);
    return position ? formatPositionDetail(position) : { text: "Position no longer available. Use /positions to refresh." };
  } catch { return { text: "Portfolio unavailable right now. Try /positions again shortly." }; }
}
