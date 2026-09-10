/**
 * In-memory paper positions — simulated_open after Approve.
 * Paper only. No keys. No live sells. Shared with /paper-balance.
 * Hydrates open rows from postgres after API restart (no re-debit).
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { positions, purchaseProposals, tokens, marketQuotes } from "@rh/db";
import { marketPnl, type EntrySnapshot, type MarketQuote } from "@rh/core";
import { getDb } from "./db.js";
import { decimalText } from "./validation.js";

export type MemPaperPosition = {
  ledgerManaged?: boolean;
  remainingQuantity?: string | null;
  remainingCost?: string | null;
  realizedPnl?: string;
  positionVersion?: number;
  id: string;
  tokenAddress: string;
  size: string | null;
  entryPrice: string | null;
  currentPrice: string | null;
  markSource: "stub_entry" | "oracle_pending" | "manual" | "dexscreener";
  markObservedAt?: string | null;
  entrySnapshot?: EntrySnapshot | null;
  marketQuote?: MarketQuote | null;
  marketError?: string | null;
  pnlAbs: string | null;
  pnlPct: number | null;
  status: string; // simulated_open | alert_fired | …
  proposalId: string | null;
  symbol: string | null;
  openedAt: string;
  closedAt: string | null;
  note: string | null;
  chainId: 4663;
};

export const memPaperPositions: MemPaperPosition[] = [];

function startingPaperCash(): number {
  const value = decimalText(process.env.PAPER_CASH_ETH?.trim() || "1.0", true);
  return value === null ? 1 : Number(value);
}

export let paperCashEth = startingPaperCash();

export function parseEthSize(size: string | null | undefined): number | null {
  if (!size?.startsWith("eth:")) return null;
  const value = decimalText(size.slice(4));
  return value === null ? null : Number(value);
}

function parseFiniteNum(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function entryFromScores(scores: unknown): string | null {
  if (!scores || typeof scores !== "object") return null;
  const s = scores as Record<string, unknown>;
  for (const key of ["entryEstimate", "entryPrice", "mark"] as const) {
    const v = s[key];
    if (v == null || v === "") continue;
    const str = decimalText(v);
    if (str !== null) return str;
  }
  return null;
}

function symbolFromScores(scores: unknown): string | null {
  if (!scores || typeof scores !== "object") return null;
  const v = (scores as Record<string, unknown>).symbol;
  if (v == null || v === "") return null;
  return String(v).replace(/^\$/, "") || null;
}

function remainingMarketPnl(p: MemPaperPosition) {
  if (!p.entrySnapshot) return null;
  if (p.ledgerManaged && p.remainingQuantity != null && Number(p.remainingQuantity) === 0) return { price: 0, pnl: 0, percent: 0, currency: p.entrySnapshot.currency, value: 0 };
  const entry = p.ledgerManaged ? { ...p.entrySnapshot, quantity: Number(p.remainingQuantity), cost: Number(p.remainingCost) } : p.entrySnapshot;
  return marketPnl(entry, p.marketQuote, p.marketError);
}

/** Phone-ready position payload (GET /positions + Approve response). */
export function toPositionPayload(p: MemPaperPosition) {
  const u = computeUnrealized(p);
  const size = /^(eth|usd):(.+)$/.exec(p.size ?? "");
  const cost = p.ledgerManaged ? Number(p.remainingCost) : size ? Number(size[2]) : NaN;
  const market = remainingMarketPnl(p);
  const valuationStatus = p.entrySnapshot ? market ? "market_estimate" : "market_unavailable" : !p.entryPrice ? "entry_missing" : p.markSource === "stub_entry" ? "placeholder" : u.unrealizedPct == null ? "price_missing" : "recorded_mark";
  const pnl = market ? market.pnl : valuationStatus === "recorded_mark" && Number.isFinite(cost) && cost > 0 && u.unrealizedPct != null ? cost * u.unrealizedPct / 100 : null;
  return {
    id: p.id,
    ledgerManaged: p.ledgerManaged ?? false,
    remainingQuantity: p.remainingQuantity ?? null,
    remainingCost: p.remainingCost ?? null,
    realizedPnl: p.realizedPnl ?? "0",
    positionVersion: p.positionVersion ?? 0,
    tokenCA: p.tokenAddress,
    tokenAddress: p.tokenAddress,
    chainId: p.chainId,
    size: p.size,
    entryPrice: p.entryPrice,
    currentPrice: p.currentPrice,
    markSource: p.markSource,
    pnlAbs: p.pnlAbs,
    pnlPct: p.pnlPct,
    valuationStatus,
    unrealizedPnl: pnl != null && Number.isFinite(pnl) ? pnl : null,
    pnlCurrency: size?.[1].toUpperCase() ?? null,
    currentValue: pnl != null && Number.isFinite(cost + pnl) ? cost + pnl : null,
    entrySnapshot: p.entrySnapshot ?? null,
    marketQuote: p.marketQuote ?? null,
    marketError: p.marketError ?? null,
    markObservedAt: p.markObservedAt ?? null,
    status: p.status,
    proposalId: p.proposalId,
    symbol: p.symbol,
    openedAt: p.openedAt,
    closedAt: p.closedAt,
    note: p.note,
    paperOnly: true as const,
  };
}

/** Open paper positions (still on book after restart hydrate). */
export function getOpenPositions(): MemPaperPosition[] {
  return memPaperPositions.filter(
    (p) => p.status === "simulated_open" || p.status === "alert_fired"
  );
}

/**
 * ETH position value at the supplied mark; retain cost basis when marks are
 * unavailable. USD sizes are excluded because no ETH/USD conversion exists.
 */
export function sumPositionsEth(): number {
  let sum = 0;
  for (const p of getOpenPositions()) {
    const eth = parseEthSize(p.size);
    if (eth != null) {
      const pnl = computeUnrealized(p).unrealizedEth;
      sum += eth + (pnl ?? 0);
    }
  }
  return sum;
}

/**
 * Unrealized PnL vs mark for paper balance / TG.
 * stub_entry with mark==entry → 0; oracle_pending / missing → nulls.
 */
export function computeUnrealized(p: MemPaperPosition): {
  unrealizedPct: number | null;
  unrealizedEth: number | null;
  markLabel: string;
} {
  if (p.entrySnapshot) {
    const result = remainingMarketPnl(p);
    p.currentPrice = result ? String(result.price) : null;
    p.markSource = "dexscreener";
    p.markObservedAt = p.marketQuote?.observedAt ?? null;
    p.pnlPct = result?.percent ?? null;
    p.pnlAbs = result?.currency === "ETH" ? String(result.pnl) : null;
    return { unrealizedPct: result?.percent ?? null, unrealizedEth: result?.currency === "ETH" ? result.pnl : null,
      markLabel: result ? "dexscreener_estimate" : "market_unavailable" };
  }
  const entry = parseFiniteNum(p.entryPrice);
  const mark = parseFiniteNum(p.currentPrice);

  if (p.markSource === "oracle_pending" || mark == null || mark < 0 || entry == null || entry <= 0) {
    p.pnlPct = null;
    p.pnlAbs = null;
    return {
      unrealizedPct: null,
      unrealizedEth: null,
      markLabel: "oracle_pending",
    };
  }

  if (p.markSource === "stub_entry" && mark === entry) {
    p.pnlPct = 0;
    p.pnlAbs = parseEthSize(p.size) === null ? null : "0";
    return {
      unrealizedPct: 0,
      unrealizedEth: parseEthSize(p.size) === null ? null : 0,
      markLabel: "stub_entry (=entry)",
    };
  }

  const pct = ((mark - entry) / entry) * 100;
  const sizeEth = parseEthSize(p.size);
  const unrealizedEth = sizeEth != null ? sizeEth * ((mark - entry) / entry) : null;

  p.pnlPct = pct;
  p.pnlAbs =
    unrealizedEth != null ? String(unrealizedEth) : null;

  const markLabel =
    p.markSource === "manual"
      ? "manual"
      : p.markSource === "stub_entry"
        ? "stub_entry"
        : String(p.markSource);

  return { unrealizedPct: pct, unrealizedEth, markLabel };
}

/**
 * Set paper mark for testing unrealized PnL. Paper only — no keys / no RPC.
 */
export function setPaperMark(
  id: string,
  mark: string,
  source: "manual" | "stub_entry" = "manual"
): MemPaperPosition | null {
  const pos = memPaperPositions.find((p) => p.id === id);
  if (!pos) return null;
  const trimmed = decimalText(mark, true);
  if (trimmed === null) return null;
  pos.currentPrice = trimmed;
  pos.markSource = source;
  pos.markObservedAt = new Date().toISOString();
  computeUnrealized(pos);
  return pos;
}

/**
 * Open a paper position from an approved purchase proposal.
 * Idempotent on proposalId while status is simulated_open.
 * Always mutates shared mem (dual-write companion to optional DB insert).
 * STILL debits cash when opening fresh.
 */
export function openPaperFromProposal(proposal: {
  id: string;
  tokenAddress: string | null;
  size: string | null;
  scores?: unknown;
  rationale?: string | null;
  entrySnapshot?: EntrySnapshot | null;
  register?: boolean;
}): MemPaperPosition {
  const existing = memPaperPositions.find(
    (p) =>
      p.proposalId === proposal.id &&
      (p.status === "simulated_open" || p.status === "alert_fired")
  );
  if (existing && proposal.register !== false) return existing;

  const entryPrice = proposal.entrySnapshot ? String(proposal.entrySnapshot.unitPrice) : entryFromScores(proposal.scores ?? null);
  const markSource: MemPaperPosition["markSource"] = proposal.entrySnapshot ? "dexscreener" : entryPrice
    ? "stub_entry"
    : "oracle_pending";
  const currentPrice = entryPrice ? entryPrice : null;
  const symbol = symbolFromScores(proposal.scores ?? null);
  const tokenAddress = (proposal.tokenAddress ?? "").toLowerCase() || "0x0";

  const ethDebit = parseEthSize(proposal.size);
  if (proposal.register !== false && ethDebit != null && ethDebit > 0) {
    paperCashEth = Math.max(0, paperCashEth - ethDebit);
  }

  const pos: MemPaperPosition = {
    id: crypto.randomUUID(),
    tokenAddress,
    size: proposal.size,
    entryPrice,
    currentPrice,
    markSource,
    entrySnapshot: proposal.entrySnapshot ?? null,
    marketQuote: proposal.entrySnapshot?.quote ?? null,
    marketError: null,
    markObservedAt: proposal.entrySnapshot?.quote.observedAt ?? null,
    pnlAbs: null,
    pnlPct: null,
    status: "simulated_open",
    proposalId: proposal.id,
    symbol,
    openedAt: new Date().toISOString(),
    closedAt: null,
    note:
      proposal.rationale?.slice(0, 240) ??
      "PAPER simulated_open from Approve — no keys; no live fill",
    chainId: 4663,
  };
  if (proposal.register !== false) memPaperPositions.unshift(pos);
  return pos;
}

type DbPositionRow = {
  ledgerManaged?: boolean;
  remainingQuantity?: string | null;
  remainingCost?: string | null;
  realizedPnl?: string;
  positionVersion?: number;
  id: string;
  tokenAddress: string | null;
  size: string | null;
  entryPrice: string | null;
  currentPrice: string | null;
  pnlAbs: string | null;
  pnlPct: number | null;
  status: string;
  proposalId: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  note: string | null;
  symbol?: string | null;
  entrySnapshot?: Record<string, unknown> | null;
  markSource?: string | null;
  markObservedAt?: Date | null;
};

/** Map a postgres positions row → MemPaperPosition (no cash side-effects). */
export function dbRowToMem(row: DbPositionRow): MemPaperPosition {
  const entry = row.entryPrice;
  const mark = row.currentPrice;
  let markSource: MemPaperPosition["markSource"] = "oracle_pending";
  if (mark && entry && mark === entry) markSource = "stub_entry";
  else if (mark) markSource = "manual";
  else markSource = "oracle_pending";
  if (row.markSource === "manual" || row.markSource === "stub_entry" || row.markSource === "dexscreener") markSource = row.markSource;

  return {
    id: row.id,
    ledgerManaged: row.ledgerManaged,
    remainingQuantity: row.remainingQuantity,
    remainingCost: row.remainingCost,
    realizedPnl: row.realizedPnl,
    positionVersion: row.positionVersion,
    tokenAddress: (row.tokenAddress ?? "").toLowerCase() || "0x0",
    size: row.size,
    entryPrice: entry,
    currentPrice: mark,
    markSource,
    entrySnapshot: row.entrySnapshot as EntrySnapshot | null | undefined,
    markObservedAt: row.markObservedAt?.toISOString() ?? null,
    pnlAbs: row.pnlAbs,
    pnlPct: row.pnlPct,
    status: row.status,
    proposalId: row.proposalId,
    symbol: row.symbol ?? null,
    openedAt: row.openedAt ? row.openedAt.toISOString() : new Date().toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    note: row.note,
    chainId: 4663,
  };
}

/**
 * Pull simulated_open / alert_fired from postgres into mem after restart.
 * Does NOT re-debit cash — openPaperFromProposal still debits on fresh opens.
 */
export async function hydrateOpenFromDb(): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const rows = await db
      .select({ position: positions, tokenSymbol: tokens.symbol, proposalScores: purchaseProposals.scores, quote: marketQuotes.quote, marketError: marketQuotes.lastError })
      .from(positions)
      .leftJoin(tokens, and(eq(tokens.chainId, 4663), sql`lower(${tokens.address}) = lower(${positions.tokenAddress})`))
      .leftJoin(purchaseProposals, eq(purchaseProposals.id, positions.proposalId))
      .leftJoin(marketQuotes, and(eq(marketQuotes.chainId, 4663), sql`${marketQuotes.tokenAddress} = lower(${positions.tokenAddress})`))
      .where(inArray(positions.status, ["simulated_open", "alert_fired"]));
    const memIds = new Set(memPaperPositions.map((p) => p.id));
    const memProposalIds = new Set(
      memPaperPositions
        .map((p) => p.proposalId)
        .filter((x): x is string => !!x)
    );
    for (const joined of rows) {
      const row = joined.position;
      const symbol = joined.tokenSymbol || symbolFromScores(joined.proposalScores);
      if (memIds.has(row.id)) {
        const existing = memPaperPositions.find((p) => p.id === row.id);
        if (existing && !existing.symbol && symbol) existing.symbol = symbol;
        if (existing) { existing.marketQuote = joined.quote as MarketQuote | null; existing.marketError = joined.marketError; }
        continue;
      }
      if (row.proposalId && memProposalIds.has(row.proposalId)) continue;
      const mem = dbRowToMem({ ...row, symbol });
      mem.marketQuote = joined.quote as MarketQuote | null; mem.marketError = joined.marketError;
      memPaperPositions.unshift(mem);
      memIds.add(mem.id);
      if (mem.proposalId) memProposalIds.add(mem.proposalId);
    }
  } catch (err) {
    console.warn(
      "[paper-positions] hydrateOpenFromDb failed:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Recompute paperCashEth from starting cash minus open eth: sizes.
 * Call on balance/list reads so cash matches opens after restart.
 */
export function recomputePaperCashFromOpens(): void {
  const startingCash = startingPaperCash();
  let spent = 0;
  for (const p of getOpenPositions()) {
    const eth = parseEthSize(p.size);
    if (eth != null && eth > 0) spent += eth;
  }
  paperCashEth = Math.max(0, startingCash - spent);
}

/** Live cash after recompute — prefer over importing the let binding. */
export function getPaperCashEth(): number {
  return paperCashEth;
}

/**
 * Hydrate opens from DB, recompute cash, return open mem positions.
 * Used by GET /paper-balance so TG /balance survives API restart.
 */
export async function listOpenPositionsMerged(): Promise<MemPaperPosition[]> {
  await hydrateOpenFromDb();
  recomputePaperCashFromOpens();
  return getOpenPositions();
}
