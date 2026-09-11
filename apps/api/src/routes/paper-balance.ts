/**
 * Paper balance for Nick buy stack — purse + paper positions + buy wallets.
 * Never includes watched-wallet alphas. No keys / no RPC signing.
 * Hydrates opens from DB so cash+positions survive API restart.
 */
import { Hono } from "hono";
import { ledgerBook, ledgerEnabled } from "../paper-ledger.js";
import { memBuyWallets } from "./buy-wallets.js";
import {
  computeUnrealized,
  getPaperCashEth,
  listOpenPositionsMerged,
  sumPositionsEth,
  toPositionPayload,
} from "../paper-positions-mem.js";

export const paperBalanceRoutes = new Hono();

function fmtEth(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(6).replace(/\.?0+$/, "");
  return s || "0";
}

paperBalanceRoutes.get("/", async (c) => {
  if (ledgerEnabled()) {
    try { return c.json({ data: (await ledgerBook()).balance, paperOnly: true }); }
    catch { return c.json({ error: "paper_book_unavailable" }, 503); }
  }
  const open = await listOpenPositionsMerged();
  let unrealizedSum = 0;
  let incompleteMarks = false;

  const positions = open.map((p) => {
    const u = computeUnrealized(p);
    if (u.unrealizedEth == null || p.markSource === "stub_entry") incompleteMarks = true;
    else unrealizedSum += u.unrealizedEth;
    return {
      ...toPositionPayload(p),
      id: p.id,
      tokenCA: p.tokenAddress,
      symbol: p.symbol ?? undefined,
      size: p.size ?? undefined,
      entryPrice: p.entryPrice ?? undefined,
      mark: p.currentPrice ?? undefined,
      markSource: p.markSource,
      markLabel: u.markLabel,
      unrealizedPct: u.unrealizedPct,
      unrealizedEth: u.unrealizedEth,
      unrealizedUsd: null as number | null,
      pnlPct: p.pnlPct,
      proposalId: p.proposalId,
    };
  });

  const cash = getPaperCashEth();
  const positionsEth = sumPositionsEth();
  const equity = cash + positionsEth;

  const buyWallets = memBuyWallets.map((w) => ({
    address: w.address,
    label: w.label,
    kind: w.kind,
    chainId: w.chainId,
    nativeEth: null as string | null,
    note: "rpc_pending — read-only RH 4663 balance when RPC wired; no keys",
  }));

  const incompleteNote = incompleteMarks
    ? " Incomplete ETH valuation: unpriced ETH positions use cost basis; USD positions are excluded until conversion is available."
    : "";

  return c.json({
    data: {
      paperOnly: true as const,
      valuationComplete: !incompleteMarks,
      cashEth: fmtEth(cash),
      equityEth: fmtEth(equity),
      positions,
      buyWallets,
      totals: {
        cashEth: fmtEth(cash),
        positionsEth: fmtEth(positionsEth),
        unrealizedEth: fmtEth(unrealizedSum),
        equityEth: fmtEth(equity),
      },
      note:
        "PAPER tracking — no keys; watched alphas excluded. Marks may be stub_entry / oracle_pending — not live oracle." +
        incompleteNote +
        " positionsEth uses ETH cost basis plus available unrealized ETH PnL. Buy wallets optional via POST /buy-wallets.",
    },
    paperOnly: true,
  });
});
