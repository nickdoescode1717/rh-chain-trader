import type { Position } from "./api.js";
import type { FormattedMessage } from "./format.js";
import { amount, positionMetrics } from "./portfolio.js";
export { formatBalance, formatPositionsList } from "./portfolio.js";
const clean = (v: unknown, max = 50) => String(v ?? "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, max);
export type PaperFillInput = {
  proposalId: string; positionId?: string | null; status?: string; size?: string | null;
  sizeEth?: string | null; sizeUsd?: string | null; price?: string | null;
  tokenCA?: string | null; symbol?: string | null; next?: string | null;
  signed?: boolean; txSubmitted?: boolean; buyAddress?: string | null;
  buyAddressSelection?: string | null; keyModel?: string | null;
};
export function formatPaperFillSuccess(input: PaperFillInput): FormattedMessage {
  const size = input.sizeEth != null ? `${amount(input.sizeEth)} ETH` : input.sizeUsd != null ? `${amount(input.sizeUsd)} USD` : clean(input.size?.replace(":", " "));
  return { text: ["🧾 PAPER POSITION OPENED", "", input.symbol ? `$${clean(input.symbol).replace(/^\$/, "")}` : "Token name unavailable",
    `Invested  ${size || "not recorded"}`, `Entry estimate  ${amount(input.price)}`,
    input.price ? "Awaiting a current market price for P&L." : "Entry price missing; P&L cannot be calculated yet.",
    "", "Contract", clean(input.tokenCA, 42), "Issuer identity unverified.", "",
    "Simulated only. No real funds moved.", "View your position with /positions.",
  ].join("\n") };
}
export type LargeMoveAlertInput = {
  position: Position; trigger?: { kind?: string; value?: number; direction?: string };
  researchSnapshot?: { symbol?: string; framework?: string; oneLiner?: string };
};
export function formatLargeMoveAlert({ position: p }: LargeMoveAlertInput): FormattedMessage {
  const m = positionMetrics(p);
  return { text: ["📈 PRICE MOVE · PAPER", "", p.symbol ? `$${clean(p.symbol)}` : "Unnamed token",
    m.reason ? `P&L unavailable — ${m.reason}` : `P&L  ${amount(m.pnl, true)} ${m.currency} (${amount(m.percent, true)}%)`,
    `Entry  ${amount(m.entry)} → Recorded price  ${amount(m.mark)}`,
    "", clean(p.tokenCA ?? p.tokenAddress, 42), "Manual price estimate, before fees. Selling is not connected.",
  ].join("\n"), reply_markup: { inline_keyboard: [[{ text: "Positions", callback_data: "portfolio:positions:0" }]] } };
}
