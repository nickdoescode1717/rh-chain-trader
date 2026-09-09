/**
 * In-memory paper positions — simulated_open after Approve.
 * Paper only. No keys. No live sells. Shared with /paper-balance.
 * Hydrates open rows from postgres after API restart (no re-debit).
 */
import { inArray } from "drizzle-orm";
import { positions } from "@rh/db";
import { getDb } from "./db.js";

export type MemPaperPosition = {
  id: string;
  tokenAddress: string;
  size: string | null;
  entryPrice: string | null;
  currentPrice: string | null;
  markSource: "stub_entry" | "oracle_pending" | "manual";
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

export let paperCashEth =
  Number(process.env.PAPER_CASH_ETH?.trim() || "1.0") || 1.0;

export function parseEthSize(size: string | null | undefined): number | null {
  if (!size?.startsWith("eth:")) return null;
  const n = Number(size.slice(4));
  return Number.isFinite(n) ? n : null;
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
    const str = String(v);
    if (str.length) return str;
  }
  return null;
}

function symbolFromScores(scores: unknown): string | null {
  if (!scores || typeof scores !== "object") return null;
  const v = (scores as Record<string, unknown>).symbol;
  if (v == null || v === "") return null;
  return String(v).replace(/^\$/, "") || null;
}

/** Phone-ready position payload (GET /positions + Approve response). */
export function toPositionPayload(p: MemPaperPosition) {
  return {
    id: p.id,
    tokenCA: p.tokenAddress,
    tokenAddress: p.tokenAddress,
    chainId: p.chainId,
    size: p.size,
    entryPrice: p.entryPrice,
    currentPrice: p.currentPrice,
    markSource: p.markSource,
    pnlAbs: p.pnlAbs,
    pnlPct: p.pnlPct,
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
 * Book value stub for equity: eth: size notional when markSource is stub_entry;
 * 0 when no usable mark (oracle_pending).
 */
export function sumPositionsEthStub(): number {
  let sum = 0;
  for (const p of getOpenPositions()) {
    if (p.markSource !== "stub_entry") continue;
    const eth = parseEthSize(p.size);
    if (eth != null) sum += eth;
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
  const entry = parseFiniteNum(p.entryPrice);
  const mark = parseFiniteNum(p.currentPrice);

  if (p.markSource === "oracle_pending" || mark == null || entry == null) {
    return {
      unrealizedPct: null,
      unrealizedEth: null,
      markLabel: "oracle_pending",
    };
  }

  if (entry === 0) {
    return {
      unrealizedPct: null,
      unrealizedEth: null,
      markLabel: p.markSource === "stub_entry" ? "stub_entry" : String(p.markSource),
    };
  }

  if (p.markSource === "stub_entry" && mark === entry) {
    p.pnlPct = 0;
    p.pnlAbs = "0";
    return {
      unrealizedPct: 0,
      unrealizedEth: 0,
      markLabel: "stub_entry (=entry)",
    };
  }

  const pct = ((mark - entry) / entry) * 100;
  const sizeEth = parseEthSize(p.size);
  const unrealizedEth = sizeEth != null ? sizeEth * ((mark - entry) / entry) : null;

  p.pnlPct = pct;
  p.pnlAbs =
    unrealizedEth != null
      ? String(unrealizedEth)
      : mark != null && entry != null
        ? String(mark - entry)
        : null;

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
  const trimmed = String(mark ?? "").trim();
  if (!trimmed.length) return null;
  pos.currentPrice = trimmed;
  pos.markSource = source;
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
}): MemPaperPosition {
  const existing = memPaperPositions.find(
    (p) =>
      p.proposalId === proposal.id &&
      (p.status === "simulated_open" || p.status === "alert_fired")
  );
  if (existing) return existing;

  const entryPrice = entryFromScores(proposal.scores ?? null);
  const markSource: MemPaperPosition["markSource"] = entryPrice
    ? "stub_entry"
    : "oracle_pending";
  const currentPrice = entryPrice ? entryPrice : null;
  const symbol = symbolFromScores(proposal.scores ?? null);
  const tokenAddress = (proposal.tokenAddress ?? "").toLowerCase() || "0x0";

  const ethDebit = parseEthSize(proposal.size);
  if (ethDebit != null && ethDebit > 0) {
    paperCashEth = Math.max(0, paperCashEth - ethDebit);
  }

  const pos: MemPaperPosition = {
    id: crypto.randomUUID(),
    tokenAddress,
    size: proposal.size,
    entryPrice,
    currentPrice,
    markSource,
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
  memPaperPositions.unshift(pos);
  return pos;
}

type DbPositionRow = {
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
};

/** Map a postgres positions row → MemPaperPosition (no cash side-effects). */
export function dbRowToMem(row: DbPositionRow): MemPaperPosition {
  const entry = row.entryPrice;
  const mark = row.currentPrice;
  let markSource: MemPaperPosition["markSource"] = "oracle_pending";
  if (mark && entry && mark === entry) markSource = "stub_entry";
  else if (mark) markSource = "manual";
  else markSource = "oracle_pending";

  return {
    id: row.id,
    tokenAddress: (row.tokenAddress ?? "").toLowerCase() || "0x0",
    size: row.size,
    entryPrice: entry,
    currentPrice: mark,
    markSource,
    pnlAbs: row.pnlAbs,
    pnlPct: row.pnlPct,
    status: row.status,
    proposalId: row.proposalId,
    symbol: null,
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
      .select()
      .from(positions)
      .where(inArray(positions.status, ["simulated_open", "alert_fired"]));
    const memIds = new Set(memPaperPositions.map((p) => p.id));
    const memProposalIds = new Set(
      memPaperPositions
        .map((p) => p.proposalId)
        .filter((x): x is string => !!x)
    );
    for (const row of rows) {
      if (memIds.has(row.id)) continue;
      if (row.proposalId && memProposalIds.has(row.proposalId)) continue;
      const mem = dbRowToMem(row);
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
  const startingCash =
    Number(process.env.PAPER_CASH_ETH?.trim() || "1.0") || 1.0;
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
