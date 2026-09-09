/**
 * Format paper proposal + LARGE-move alert Telegram messages + inline keyboards.
 * Plain text only (no parse_mode). Desk-depth proposal alerts. Paper only.
 */

import type { Position, Proposal } from "./api.js";
import {
  asRecord,
  evidenceBullets,
  exitsLine,
  gateLine,
  leadLabel,
  num,
  riskChecks,
  shortCa,
  sizeLine,
  str,
  truncate,
} from "./format-desk.js";

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export type FormattedMessage = {
  text: string;
  reply_markup: InlineKeyboard;
};

/** Desk-depth purchase proposal alert + Approve / Reject buttons */
export function formatProposal(p: Proposal): FormattedMessage {
  const ca = String(p.tokenCA ?? p.tokenAddress ?? "");
  const scores = asRecord(p.scores);
  const framework = str(scores?.framework ?? (p as { framework?: unknown }).framework, "unknown");
  const symbol = str(
    (p as { tokenSymbol?: unknown }).tokenSymbol ??
      (p as { symbol?: unknown }).symbol ??
      scores?.symbol,
    "-"
  );
  const platform = str(
    (p as { platform?: unknown }).platform ??
      scores?.platform ??
      scores?.platformName,
    "-"
  );
  const thesis = str(
    p.rationale ?? scores?.thesis ?? scores?.oneLiner,
    "-"
  ).slice(0, 400);

  const opp = num(scores?.opportunity);
  const risk = num(scores?.risk);
  const conf = num(scores?.evidenceConfidence ?? scores?.evidence);
  const gate = gateLine(scores);

  const evidence = evidenceBullets(p);
  const checks = riskChecks(p);

  const lines: Array<string | null> = [
    "PAPER ONLY — purchase proposal (AFK)",
    `Status: ${str(p.status, "pending_nick")}`,
    `ID: ${p.id}`,
    "",
    "— Token —",
    `Symbol: ${symbol}`,
    `Chain: ${p.chainId ?? 4663} (Robinhood Chain)`,
    `Contract: ${ca || "-"}`,
    `Short: ${shortCa(ca)}`,
    "",
    "— Lead / thesis —",
    `Lead source: ${leadLabel(p.leadSource ?? null)}`,
    `Platform: ${platform}`,
    `Framework: ${framework} (meme≠utility)`,
    `Thesis: ${thesis}`,
    "",
    "— Scores (Desk) —",
    `Opportunity: ${opp}`,
    `Risk: ${risk}`,
    `Evidence-confidence: ${conf}`,
    gate,
    "",
    "— Size (paper) —",
    `Notional: ${sizeLine(p)}`,
    `Slippage: ${p.slippageBps ?? "-"} bps`,
    exitsLine(p),
  ];

  if (evidence.length) {
    lines.push("", "— Evidence —", ...evidence);
  } else {
    lines.push("", "— Evidence —", "- (none attached)");
  }

  if (checks.length) {
    lines.push("", "— Hard-reject / risk checks —", ...checks);
  } else {
    lines.push(
      "",
      "— Hard-reject / risk checks —",
      "- (none attached; Desk should fill on clear)"
    );
  }

  lines.push(
    "",
    "PAPER ONLY. Approve -> revalidate -> signer_handoff_stub.",
    "No keys. No live tx. ENABLE_TRADING stays false."
  );

  const text = truncate(lines.filter((x) => x != null) as string[]);

  return {
    text,
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
    "PAPER ONLY — LARGE-move alert (AFK)",
    `Position: ${pos.id}`,
    `Contract: ${ca || "-"} (chain ${pos.chainId ?? 4663})`,
    `Size: ${pos.size ?? "-"} (paper)`,
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
    "PAPER ONLY. Sell -> propose only. No live sells. No keys.",
  ].filter((x) => x != null) as string[];

  return {
    text: truncate(lines),
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
