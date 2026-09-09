/**
 * Paper balance for Nick buy stack — purse + paper positions + buy wallets.
 * Never includes watched-wallet alphas. No keys / no RPC signing.
 */
import { Hono } from "hono";
import { memBuyWallets } from "./buy-wallets.js";

export const paperBalanceRoutes = new Hono();

paperBalanceRoutes.get("/", (c) => {
  const cashEth = process.env.PAPER_CASH_ETH?.trim() || "1.0";
  // Positions API still 403 — empty until paper positions wire-up
  const positions: Array<{
    id: string;
    tokenCA?: string;
    symbol?: string;
    size?: string;
    entryPrice?: string;
    mark?: string;
    pnlPct?: number | null;
  }> = [];

  const buyWallets = memBuyWallets.map((w) => ({
    address: w.address,
    label: w.label,
    kind: w.kind,
    chainId: w.chainId,
    nativeEth: null as string | null,
    note: "rpc_pending — read-only RH 4663 balance when RPC wired; no keys",
  }));

  const cash = Number(cashEth);
  const positionsEth = 0;
  const equity = (Number.isFinite(cash) ? cash : 0) + positionsEth;

  return c.json({
    data: {
      paperOnly: true as const,
      cashEth: String(cashEth),
      equityEth: equity.toFixed(6).replace(/\.?0+$/, "") || "0",
      positions,
      buyWallets,
      totals: {
        cashEth: String(cashEth),
        positionsEth: "0",
        equityEth: equity.toFixed(6).replace(/\.?0+$/, "") || "0",
      },
      note:
        "PAPER — buy wallets empty until Nick registers via POST /buy-wallets; watched alphas excluded; no keys",
    },
    paperOnly: true,
  });
});
