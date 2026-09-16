/**
 * Desk-order Telegram proposal formatter — plain text (no parse_mode).
 * Top: overall /10 + emoji. Header shows FULL CA + mcap. Trade repeats CA/mcap/liq.
 */

import type { Proposal } from "./api.js";
import {
  asRecord,
  evidenceBullets,
  exitsLine,
  fullCa,
  leadExtra,
  leadLabel,
  marketLines,
  riskLines,
  scoreDisplay,
  scoreWhy,
  section,
  sizeLine,
  str,
  truncate,
} from "./format-desk.js";
import { overallRating } from "./format-rating.js";

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

export type FormattedMessage = {
  text: string;
  reply_markup?: InlineKeyboard;
};

export function formatProposal(p: Proposal): FormattedMessage {
  const identityBlocked = p.identityGateEnabled === true && p.issuerIdentity?.status !== "verified";
  const ca = fullCa(p);
  const scores = asRecord(p.scores);
  const market = marketLines(p, scores);
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
  const rating = overallRating(scores, p);

  const lines = [
    `${rating.line} · $${symbol} · 4663 · 📄 PAPER`,
    `CA: ${ca}`,
    p.projectHandle ? `Project: @${p.projectHandle.replace(/[^a-z0-9_]/gi, "").slice(0,15)}` : "Project linkage: not supplied",
    "Paper fill model: budget includes 0.3% fee; 0.5% adverse price slippage. Gas, token taxes and liquidity impact excluded.",
    p.identityGateEnabled ? `IDENTITY ${String(p.issuerIdentity?.status ?? "unverified").toUpperCase()} · ${identityBlocked ? "Paper buy blocked" : "Reviewed source + deployment match; safety unproven"}`
      : "IDENTITY UNVERIFIED · Names, tickers and high scores do not prove this is the official token.",
    ...(p.identityGateEnabled ? (p.issuerIdentity?.reasons ?? []).map(r=>r.replaceAll("_"," ").slice(0,160)) : []),
    ...(p.identityGateEnabled && p.issuerIdentity?.sourceUrl ? [`Identity source: ${p.issuerIdentity.sourceUrl.slice(0,500)}`] : []),
    `Mcap: ${market.mcapLine}`,
    "━━━━━━━━━━━━━━━━━━━━",
    section("TOKEN", "🪙"),
    `CA: ${ca}`,
    `Mcap: ${market.mcapLine}`,
    `Liq: ${market.liqLine}`,
    `ID: ${p.id}`,
    `Status: ${str(p.status, "pending_nick")}`,
    market.incomplete
      ? "⚠ Incomplete: Desk must attach full CA + mcap (+ liq when known)."
      : null,
    "",
    section("THESIS", "📌"),
    thesis,
    `Lead: ${lead}${extra ? ` · ${extra}` : ""}`,
    `Framework: ${fw} (meme ≠ utility)`,
    "",
    section("SCORES", "📊"),
    `Opportunity: ${scoreDisplay(scores?.opportunity)}${scoreWhy(scores, "opportunity")}`,
    `Risk: ${scoreDisplay(scores?.risk)}${scoreWhy(scores, "risk")}`,
    `Evidence: ${scoreDisplay(scores?.evidenceConfidence ?? scores?.evidence, true)}${scoreWhy(scores, "evidenceConfidence")}`,
    `Overall: ${rating.line}  (opp×(1−risk)×evidence)`,
    "",
    section("SOURCES", "🔗"),
    ...(sources.length ? sources : ["• (none — do not trust CT alone)"]),
    "",
    section("RISKS", "⚠️"),
    ...risks,
    "",
    section("TRADE", "💸"),
    `CA: ${ca}`,
    `Mcap: ${market.mcapLine}`,
    `Liq: ${market.liqLine}`,
    `Size: ${sizeLine(p)}`,
    "Paper execution uses the model shown above.",
    `Exits: ${exitsLine(p)}`,
    `Route/pair: ${route}`,
    "",
    section("ASK", "✅"),
    identityBlocked ? "Review identity evidence first. A high score cannot bypass the gate. No trade approved." : "Decide in Telegram: Approve (paper) or Skip. No live tx. Grok provides analysis only.",
  ].filter((x) => x != null) as string[];

  return {
    text: truncate(lines),
    reply_markup: {
      inline_keyboard: [
        [
          ...(!identityBlocked ? [{ text: "✅ Approve (paper)", callback_data: `approve:${p.id}` }] : []),
          { text: "⏭ Skip", callback_data: `reject:${p.id}` },
        ],
        ...(p.projectHandle && /^[a-z0-9_]{1,15}$/.test(p.projectHandle) ? [[{text:"Identity evidence",callback_data:`identity:list:${p.projectHandle}`}]] : []),
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
  formatPositionsList,
} from "./format-extra.js";
export type { PaperFillInput, LargeMoveAlertInput } from "./format-extra.js";
