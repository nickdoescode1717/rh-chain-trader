/**
 * In-memory paper positions — simulated_open after Approve.
 * Paper only. No keys. No live sells. Shared with /paper-balance.
 */
export type MemPaperPosition = {
  id: string;
  tokenAddress: string;
  size: string | null;
  entryPrice: string | null;
  currentPrice: string | null;
  markSource: "stub_entry" | "oracle_pending" | "manual";
  pnlAbs: string | null;
  pnlPct: number | null;
  status: string; // simulated_open
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

function parseEthSize(size: string | null | undefined): number | null {
  if (!size?.startsWith("eth:")) return null;
  const n = Number(size.slice(4));
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

export function getOpenPositions(): MemPaperPosition[] {
  return memPaperPositions.filter((p) => p.status === "simulated_open");
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
 * Open a paper position from an approved purchase proposal.
 * Idempotent on proposalId while status is simulated_open.
 * Always mutates shared mem (dual-write companion to optional DB insert).
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
      p.proposalId === proposal.id && p.status === "simulated_open"
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
