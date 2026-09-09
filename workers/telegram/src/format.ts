/**
 * Format paper proposal + LARGE-move alert Telegram messages + inline keyboards.
 * Plain text only (no parse_mode) — avoids Markdown entity errors on CAs / ids.
 * Paper only — no live sells.
 */

import type { Position, Proposal } from "./api.js";

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export type FormattedMessage = {
  text: string;
  reply_markup: InlineKeyboard;
};

function shortCa(ca: string | undefined | null): string {
  if (!ca) return "-";
  if (ca.length <= 12) return ca;
  return `${ca.slice(0, 6)}...${ca.slice(-4)}`;
}

function sizeLine(p: Proposal): string {
  if (p.sizeEth != null && p.sizeEth !== "") return `${p.sizeEth} ETH`;
  if (p.sizeUsd != null && p.sizeUsd !== "") return `$${p.sizeUsd}`;
  if (typeof p.size === "string" && p.size) return p.size;
  return "-";
}

function scoreLine(scores: Record<string, unknown> | null | undefined): string {
  if (!scores) return "-";
  const o = scores.opportunity ?? "?";
  const r = scores.risk ?? "?";
  const e = scores.evidenceConfidence ?? scores.evidence ?? "?";
  const fw = scores.framework ?? "?";
  return `opp ${o} / risk ${r} / conf ${e} (${fw})`;
}

/** Purchase proposal summary + Approve / Reject buttons */
export function formatProposal(p: Proposal): FormattedMessage {
  const ca = p.tokenCA ?? p.tokenAddress ?? "";
  const lines = [
    "PAPER purchase proposal",
    `ID: ${p.id}`,
    `CA: ${shortCa(ca)} (chain ${p.chainId ?? 4663})`,
    `Size: ${sizeLine(p)}`,
    `Slippage: ${p.slippageBps ?? "-"} bps`,
    `Lead: ${p.leadSource ?? "-"}`,
    `Scores: ${scoreLine(p.scores ?? undefined)}`,
    `Status: ${p.status ?? "pending_nick"}`,
    p.expiresAt ? `Expires: ${p.expiresAt}` : null,
    p.rationale ? `Rationale: ${String(p.rationale).slice(0, 280)}` : null,
    "",
    "Paper only. Approve -> signer_handoff_stub. No keys. No live tx.",
  ].filter((x) => x != null) as string[];

  return {
    text: lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Approve (paper)", callback_data: `approve:${p.id}` },
          { text: "Reject", callback_data: `reject:${p.id}` },
        ],
      ],
    },
  };
}

export type LargeMoveAlertInput = {
  position: Position;
  trigger?: { kind?: string; value?: number; direction?: string };
  researchSnapshot?: {
    symbol?: string;
    framework?: string;
    oneLiner?: string;
  };
};

/** LARGE-move AFK alert + Sell (paper) button */
export function formatLargeMoveAlert(input: LargeMoveAlertInput): FormattedMessage {
  const { position: pos, trigger, researchSnapshot } = input;
  const ca = pos.tokenCA ?? "";
  const dir = trigger?.direction ?? "?";
  const kind = trigger?.kind ?? "pct";
  const value = trigger?.value ?? "?";
  const mark =
    pos.currentPrice == null ? "oracle pending" : String(pos.currentPrice);
  const pnl =
    pos.pnlPct == null && pos.pnlAbs == null
      ? "-"
      : `pct=${pos.pnlPct ?? "-"} abs=${pos.pnlAbs ?? "-"}`;

  const lines = [
    "PAPER LARGE-move alert (AFK)",
    `Position: ${pos.id}`,
    `CA: ${shortCa(ca)} (chain ${pos.chainId ?? 4663})`,
    `Size: ${pos.size ?? "-"}`,
    `Entry: ${pos.entryPrice ?? "-"} -> Mark: ${mark}`,
    `PnL: ${pnl}`,
    `Trigger: ${kind} ${value} (${dir})`,
    researchSnapshot?.symbol
      ? `Token: ${researchSnapshot.symbol} (${researchSnapshot.framework ?? "?"})`
      : null,
    researchSnapshot?.oneLiner
      ? `Note: ${String(researchSnapshot.oneLiner).slice(0, 200)}`
      : null,
    "",
    "Paper only. Sell -> propose only. No live sells. No keys.",
  ].filter((x) => x != null) as string[];

  return {
    text: lines.join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: "Sell (paper full)", callback_data: `sell:${pos.id}` }],
      ],
    },
  };
}

/** Callback data helpers */
export function parseCallbackData(
  data: string
):
  | { action: "approve" | "reject"; id: string }
  | { action: "sell"; positionId: string }
  | null {
  const m = /^(approve|reject|sell):(.+)$/.exec(data);
  if (!m) return null;
  const action = m[1] as "approve" | "reject" | "sell";
  const rest = m[2];
  if (!rest) return null;
  if (action === "sell") return { action, positionId: rest };
  return { action, id: rest };
}
