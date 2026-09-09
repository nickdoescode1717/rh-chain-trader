/**
 * Extra TG formatters: paper fill receipt, large-move, /balance, /positions.
 * Plain text only.
 */

import type { Position, PaperBalance } from "./api.js";
import { section, str, truncate } from "./format-desk.js";
type FormattedMessage = {
  text: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

export type PaperFillInput = {
  proposalId: string;
  positionId?: string | null;
  status?: string;
  size?: string | null;
  sizeEth?: string | null;
  sizeUsd?: string | null;
  price?: string | null;
  tokenCA?: string | null;
  symbol?: string | null;
  next?: string | null;
  signed?: boolean;
  txSubmitted?: boolean;
  buyAddress?: string | null;
  buyAddressSelection?: string | null;
  keyModel?: string | null;
};

export function formatPaperFillSuccess(input: PaperFillInput): FormattedMessage {
  const size =
    input.sizeEth != null && input.sizeEth !== ""
      ? `${input.sizeEth} ETH (paper)`
      : input.sizeUsd != null && input.sizeUsd !== ""
        ? `$${input.sizeUsd} (paper)`
        : input.size ?? "-";
  const buy =
    input.buyAddress && input.buyAddress.length
      ? input.buyAddress
      : "(none registered)";
  const lines = [
    section("PAPER FILL", "🧾"),
    "Status: paper execution receipt — position opened",
    `Proposal: ${input.proposalId}`,
    `Position: ${str(input.positionId, "(missing)")}`,
    `Token: $${str(input.symbol, "?")} · ${str(input.tokenCA, "-")}`,
    `Size: ${size}`,
    `Price: ${str(input.price, "n/a (paper stub)")}`,
    `API status: ${str(input.status, "approved")}`,
    `Next: ${str(input.next, "signer_handoff_stub")}`,
    `Buy wallet: ${buy}`,
    input.buyAddressSelection
      ? `Selection: ${input.buyAddressSelection}`
      : null,
    `Key model: ${str(input.keyModel, "single_controlling_key_multi_address")}`,
    `Signed: ${input.signed === true ? "true" : "false"}`,
    `Tx submitted: ${input.txSubmitted === true ? "true" : "false"}`,
    "",
    "PAPER ONLY — no keys, no live tx, ENABLE_TRADING=false.",
  ].filter((x) => x != null) as string[];
  return { text: truncate(lines) };
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
    section("PAPER LARGE-MOVE", "📈"),
    `Position: ${pos.id}`,
    `CA: ${ca || "-"} (chain ${pos.chainId ?? 4663})`,
    `Size: ${pos.size ?? "-"} (paper)`,
    `Entry: ${pos.entryPrice ?? "-"} → Mark: ${mark}`,
    `PnL: ${pnl}`,
    `Trigger: ${kind} ${value} (${dir})`,
    researchSnapshot?.symbol
      ? `Token: ${researchSnapshot.symbol} (${researchSnapshot.framework ?? "?"})`
      : null,
    researchSnapshot?.oneLiner
      ? `Note: ${String(researchSnapshot.oneLiner).slice(0, 200)}`
      : null,
    "",
    "PAPER ONLY. Sell → propose only. No live sells.",
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

export function formatBalance(b: PaperBalance): FormattedMessage {
  const lines: string[] = [
    section("PAPER BALANCE", "💰"),
    "Nick buy purse + open paper positions — NOT watched alphas",
    "",
    section("PAPER PURSE", "💵"),
    `Cash: ${b.cashEth} ETH`,
    `Equity: ${b.equityEth} ETH`,
    "",
    section("PAPER POSITIONS", "📦"),
  ];
  if (!b.positions.length) {
    lines.push("• (none open — Approve a proposal to open)");
  } else {
    for (const pos of b.positions.slice(0, 12)) {
      const sym = pos.symbol ? `$${pos.symbol}` : "token";
      lines.push(
        `• ${sym} ${pos.size ?? "-"} · entry ${pos.entryPrice ?? "-"} · mark ${pos.mark ?? "-"} · pnl% ${pos.pnlPct ?? "-"}`
      );
      lines.push(`  CA ${pos.tokenCA ?? "-"} · id ${pos.id}`);
    }
  }
  lines.push("", section("BUY WALLETS (4663)", "🏦"));
  if (!b.buyWallets.length) {
    lines.push("• (empty — optional later; not required for paper loop)");
  } else {
    for (const w of b.buyWallets) {
      lines.push(`• ${w.label ?? "buy"} ${w.address}`);
      lines.push(`  native: ${w.nativeEth ?? "rpc_pending"} · ${w.note ?? ""}`);
    }
  }
  lines.push(
    "",
    section("TOTALS", "Σ"),
    `Cash ${b.totals.cashEth} ETH · Positions ${b.totals.positionsEth ?? "0"} · Equity ${b.totals.equityEth} ETH`,
    "",
    str(b.note, "PAPER ONLY — watched wallets excluded. No keys.")
  );
  return { text: truncate(lines) };
}

export function formatPositionsList(positions: Position[]): FormattedMessage {
  const lines: string[] = [
    section("PAPER POSITIONS", "📦"),
    "Open / recent simulated positions",
    "",
  ];
  const open = positions.filter((p) => p.status === "simulated_open");
  const list = open.length ? open : positions;
  if (!list.length) {
    lines.push("• (none — Approve a paper proposal to open one)");
  } else {
    for (const pos of list.slice(0, 15)) {
      const sym = pos.symbol ? `$${pos.symbol}` : "token";
      lines.push(`• ${sym} · ${pos.status ?? "?"} · ${pos.size ?? "-"}`);
      lines.push(`  id ${pos.id}`);
      lines.push(`  CA ${pos.tokenCA ?? "-"}`);
      lines.push(
        `  entry ${pos.entryPrice ?? "-"} · mark ${pos.currentPrice ?? "oracle_pending"}`
      );
    }
  }
  lines.push("", "PAPER ONLY — no live sells. /balance for cash+equity.");
  return { text: truncate(lines) };
}
