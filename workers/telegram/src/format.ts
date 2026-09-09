/**
 * Desk-order Telegram proposal formatter — plain text (no parse_mode).
 * Order: Header → Thesis → Scores → Sources → Risks → Trade → Ask.
 */

import type { Proposal } from "./api.js";
import {
  asRecord,
  evidenceBullets,
  exitsLine,
  leadExtra,
  leadLabel,
  riskLines,
  scoreDisplay,
  scoreWhy,
  section,
  sizeLine,
  str,
  truncate,
} from "./format-desk.js";

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export type FormattedMessage = {
  text: string;
  reply_markup?: InlineKeyboard;
};

export function formatProposal(p: Proposal): FormattedMessage {
  const ca = String(p.tokenCA ?? p.tokenAddress ?? "");
  const scores = asRecord(p.scores);
  const symbol = str(
    (p as { tokenSymbol?: unknown }).tokenSymbol ??
      (p as { symbol?: unknown }).symbol ??
      scores?.symbol,
    "TOKEN"
  ).replace(/^\$/, "");
  const thesis = str(
    p.rationale ?? scores?.thesis ?? scores?.oneLiner,
    "(no thesis attached)"
  ).slice(0, 420);
  const lead = leadLabel(p.leadSource ?? null);
  const extra = leadExtra(p, scores);
  const fw = str(scores?.framework ?? (p as { framework?: unknown }).framework, "unknown");
  const route = str(
    scores?.route ?? scores?.pair ?? (p as { route?: unknown }).route,
    "-"
  );
  const sources = evidenceBullets(p);
  const risks = riskLines(p);

  const lines = [
    section("HEADER"),
    `$ ${symbol}  ·  chain 4663  ·  PAPER`.replace("$ ", "$"),
    `CA: ${ca || "(missing — do not approve)"}`,
    `ID: ${p.id}`,
    `Status: ${str(p.status, "pending_nick")}`,
    "",
    section("THESIS"),
    thesis,
    `Lead: ${lead}${extra ? ` · ${extra}` : ""}`,
    `Framework: ${fw} (meme ≠ utility)`,
    "",
    section("SCORES"),
    `Opportunity: ${scoreDisplay(scores?.opportunity)}${scoreWhy(scores, "opportunity")}`,
    `Risk: ${scoreDisplay(scores?.risk)}${scoreWhy(scores, "risk")}`,
    `Evidence-confidence: ${scoreDisplay(scores?.evidenceConfidence ?? scores?.evidence, true)}${scoreWhy(scores, "evidenceConfidence")}`,
    "",
    section("SOURCES"),
    ...(sources.length ? sources : ["• (none — do not trust CT alone)"]),
    "",
    section("RISKS"),
    ...risks,
    "",
    section("TRADE"),
    `Size: ${sizeLine(p)}`,
    `Slippage: ${p.slippageBps ?? "-"} bps`,
    `Exits: ${exitsLine(p)}`,
    `Route/pair: ${route}`,
    "",
    section("ASK"),
    "Approve (paper) or Skip. No keys. No live tx.",
  ];

  return {
    text: truncate(lines),
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Approve (paper)", callback_data: `approve:${p.id}` },
          { text: "Skip", callback_data: `reject:${p.id}` },
        ],
      ],
    },
  };
}

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

export {
  formatPaperFillSuccess,
  formatLargeMoveAlert,
  formatBalance,
} from "./format-extra.js";
export type { PaperFillInput, LargeMoveAlertInput } from "./format-extra.js";
