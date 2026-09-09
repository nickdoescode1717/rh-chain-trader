/**
 * Paper balance for Nick buy stack — purse + paper positions + buy wallets.
 * Never includes watched-wallet alphas. No keys / no RPC signing.
 */
import { Hono } from "hono";
import { memBuyWallets } from "./buy-wallets.js";
import {
  getOpenPositions,
  paperCashEth,
  sumPositionsEthStub,
} from "../paper-positions-mem.js";

export const paperBalanceRoutes = new Hono();

function fmtEth(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(6).replace(/\.?0+$/, "");
  return s || "0";
}

paperBalanceRoutes.get("/", (c) => {
  const open = getOpenPositions();
  const positions = open.map((p) => ({
    id: p.id,
    tokenCA: p.tokenAddress,
    symbol: p.symbol ?? undefined,
    size: p.size ?? undefined,
    entryPrice: p.entryPrice ?? undefined,
    mark: p.currentPrice ?? undefined,
    markSource: p.markSource,
    pnlPct: p.pnlPct,
    proposalId: p.proposalId,
  }));

  const cash = paperCashEth;
  const positionsEth = sumPositionsEthStub();
  const equity = cash + positionsEth;

  const buyWallets = memBuyWallets.map((w) => ({
    address: w.address,
    label: w.label,
    kind: w.kind,
    chainId: w.chainId,
    nativeEth: null as string | null,
    note: "rpc_pending — read-only RH 4663 balance when RPC wired; no keys",
  }));

  return c.json({
    data: {
      paperOnly: true as const,
      cashEth: fmtEth(cash),
      equityEth: fmtEth(equity),
      positions,
      buyWallets,
      totals: {
        cashEth: fmtEth(cash),
        positionsEth: fmtEth(positionsEth),
        equityEth: fmtEth(equity),
      },
      note:
        "PAPER tracking — no keys; watched alphas excluded. positionsEth uses size eth notional until oracle. Buy wallets optional via POST /buy-wallets.",
    },
    paperOnly: true,
  });
});
