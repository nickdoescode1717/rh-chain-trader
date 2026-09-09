/**
 * Paper positions routes — list simulated_open + recent; sell stub only.
 * Never live sells. No keys. ENABLE_TRADING stays false.
 * See docs/POSITIONS.md
 */
import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { positions } from "@rh/db";
import { getDb } from "../db.js";
import {
  getOpenPositions,
  memPaperPositions,
  toPositionPayload,
  type MemPaperPosition,
} from "../paper-positions-mem.js";

export const positionRoutes = new Hono();

function recentMem(limit = 40): MemPaperPosition[] {
  const open = getOpenPositions();
  const closedish = memPaperPositions.filter(
    (p) => p.status !== "simulated_open"
  );
  const merged = [...open, ...closedish];
  const seen = new Set<string>();
  const out: MemPaperPosition[] = [];
  for (const p of merged) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

positionRoutes.get("/", async (c) => {
  const memRows = recentMem().map(toPositionPayload);
  const db = getDb();
  if (!db) {
    return c.json({
      data: memRows,
      source: "memory",
      paperOnly: true,
      note: "Paper positions (mem). Approve opens simulated_open. No live sells.",
    });
  }

  try {
    const rows = await db
      .select()
      .from(positions)
      .orderBy(desc(positions.createdAt))
      .limit(40);
    const dbPayload = rows.map((r) => ({
      id: r.id,
      tokenCA: r.tokenAddress,
      tokenAddress: r.tokenAddress,
      chainId: 4663,
      size: r.size,
      entryPrice: r.entryPrice,
      currentPrice: r.currentPrice,
      markSource: r.currentPrice ? ("manual" as const) : ("oracle_pending" as const),
      pnlAbs: r.pnlAbs,
      pnlPct: r.pnlPct,
      status: r.status,
      proposalId: r.proposalId,
      symbol: null as string | null,
      openedAt: r.openedAt ? r.openedAt.toISOString() : null,
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      note: r.note,
      paperOnly: true as const,
    }));
    // Prefer mem for in-process consistency; append DB rows not already in mem
    const memIds = new Set(memRows.map((m) => m.id));
    const proposalIds = new Set(
      memRows.map((m) => m.proposalId).filter(Boolean) as string[]
    );
    const extras = dbPayload.filter(
      (d) => !memIds.has(d.id) && !(d.proposalId && proposalIds.has(d.proposalId))
    );
    return c.json({
      data: [...memRows, ...extras],
      source: "memory+postgres",
      paperOnly: true,
      note: "Paper positions. Mem dual-write + postgres when present. No live sells.",
    });
  } catch (err) {
    console.warn(
      "[positions] postgres list failed — mem-only:",
      err instanceof Error ? err.message : err
    );
    return c.json({
      data: memRows,
      source: "memory",
      paperOnly: true,
      note: "Paper positions (mem; postgres list failed). No live sells.",
    });
  }
});

/** Sell stub — never live. 501 paper_sell_propose_stub. */
positionRoutes.post("/:id/sell", async (c) => {
  const id = c.req.param("id");
  const pos =
    memPaperPositions.find((p) => p.id === id) ??
    null;
  return c.json(
    {
      error: "paper_sell_propose_stub",
      next: "pending_nick",
      positionId: id,
      position: pos ? toPositionPayload(pos) : null,
      paperOnly: true,
      signed: false,
      txSubmitted: false,
      note: "PAPER ONLY — sell propose stub; no live sells; no keys. pending_nick.",
    },
    501
  );
});
