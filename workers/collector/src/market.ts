import {waitForCollection} from "./collection-control.js";
import { fetchMarketQuote } from "@rh/core";
import { createDb, marketQuotes, positions, purchaseProposals } from "@rh/db";
import { eq, inArray } from "drizzle-orm";
import type { RpcClient } from "./rpc.js";
export async function runMarketLoop(rpc: RpcClient): Promise<void> {
  if (process.env.MARKET_PRICING_ENABLED !== "true" || !process.env.DATABASE_URL) return;
  const db = createDb(process.env.DATABASE_URL);
  for (;;) {
    await waitForCollection(true);
    try {
      if (await rpc.getChainId() !== 4663) throw new Error("pricing_chain_mismatch");
      const [open, pending, cached] = await Promise.all([
        db.select({ address: positions.tokenAddress }).from(positions).where(inArray(positions.status, ["simulated_open", "alert_fired"])),
        db.select({ address: purchaseProposals.tokenAddress, expiresAt: purchaseProposals.expiresAt }).from(purchaseProposals).where(eq(purchaseProposals.status, "pending_nick")),
        db.select({ address: marketQuotes.tokenAddress, attempted: marketQuotes.lastAttemptAt }).from(marketQuotes),
      ]);
      const attempts = new Map(cached.map((q) => [q.address, q.attempted.getTime()]));
      const addresses = [...new Set([...open, ...pending.filter((p) => !p.expiresAt || p.expiresAt.getTime() > Date.now())]
        .map((p) => p.address?.toLowerCase()).filter((a): a is string => !!a && /^0x[a-f0-9]{40}$/.test(a)))];
      addresses.sort((a, b) => (attempts.get(a) ?? 0) - (attempts.get(b) ?? 0));
      for (const address of addresses.slice(0, 10)) {
        const attempted = new Date();
        try {
          const quote = await fetchMarketQuote(address);
          await db.insert(marketQuotes).values({ tokenAddress: address, quote, lastAttemptAt: attempted, lastError: null })
            .onConflictDoUpdate({ target: marketQuotes.tokenAddress, set: { quote, lastAttemptAt: attempted, lastError: null } });
        } catch (err) {
          const known = new Set(["no_eligible_eth_pool", "conflicting_pool_prices", "provider_rate_limited", "provider_response_too_large"]);
          const error = err instanceof Error && known.has(err.message) ? err.message : "provider_unavailable";
          await db.insert(marketQuotes).values({ tokenAddress: address, lastAttemptAt: attempted, lastError: error })
            .onConflictDoUpdate({ target: marketQuotes.tokenAddress, set: { lastAttemptAt: attempted, lastError: error } });
          if (error === "provider_rate_limited") break;
        }
      }
    } catch { console.warn("[market] collection unavailable; retrying next minute"); }
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}

