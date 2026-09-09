/**
 * Recent watched-wallet events for Desk lead feed (paper / research only).
 * Desk JSON shape is fixed — exact field names required by Desk.
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { walletEvents, wallets, tokens } from "@rh/db";
import { getDb } from "../db.js";
import { memWalletEvents } from "../memory-store.js";

export const walletEventRoutes = new Hono();

/** Desk wallet-event / lead JSON shape (exact field names). */
export interface DeskWalletEvent {
  leadSource: "watched_wallet";
  wallet: string;
  walletLabel: string | null;
  token: string | null;
  tokenSymbol: string | null;
  amount: string | null;
  amountUsd: null;
  txHash: string | null;
  block: number | null;
  entryEstimate: null;
  otherWatchedOnToken: string[];
  observedAt: string;
}

walletEventRoutes.get("/", async (c) => {
  const limitRaw = Number(c.req.query("limit") ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 500)
    : 50;

  const db = getDb();
  if (!db) {
    const data = memWalletEvents
      .slice()
      .sort(
        (a, b) =>
          new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
      )
      .slice(0, limit);
    return c.json({ data, source: "memory" });
  }

  const rows = await db
    .select({
      amount: walletEvents.amount,
      txHash: walletEvents.txHash,
      blockNumber: walletEvents.blockNumber,
      metadata: walletEvents.metadata,
      observedAt: walletEvents.observedAt,
      wallet: wallets.address,
      walletLabel: wallets.label,
      tokenAddress: tokens.address,
      tokenSymbol: tokens.symbol,
    })
    .from(walletEvents)
    .innerJoin(wallets, eq(walletEvents.walletId, wallets.id))
    .leftJoin(tokens, eq(walletEvents.tokenId, tokens.id))
    .orderBy(desc(walletEvents.observedAt))
    .limit(limit);

  const data: DeskWalletEvent[] = rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const other = Array.isArray(meta.otherWatchedOnToken)
      ? (meta.otherWatchedOnToken as string[])
      : [];
    return {
      leadSource: "watched_wallet" as const,
      wallet: r.wallet,
      walletLabel: r.walletLabel ?? null,
      token: r.tokenAddress ?? null,
      tokenSymbol: r.tokenSymbol ?? null,
      amount: r.amount ?? null,
      amountUsd: null,
      txHash: r.txHash ?? null,
      block: r.blockNumber ?? null,
      entryEstimate: null,
      otherWatchedOnToken: other,
      observedAt:
        r.observedAt instanceof Date
          ? r.observedAt.toISOString()
          : String(r.observedAt),
    };
  });

  return c.json({ data, source: "postgres" });
});
