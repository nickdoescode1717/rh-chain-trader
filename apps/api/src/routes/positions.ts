/**
 * Paper positions routes — list simulated_open + recent; sell stub only.
 * Never live sells. No keys. ENABLE_TRADING stays false.
 * Hydrates opens from postgres after API restart.
 * See docs/POSITIONS.md
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { positions } from "@rh/db";
import { getDb } from "../db.js";
import { decimalText, isRecord } from "../validation.js";
import {
  getOpenPositions,
  hydrateOpenFromDb,
  memPaperPositions,
  setPaperMark,
  toPositionPayload,
  type MemPaperPosition,
} from "../paper-positions-mem.js";

export const positionRoutes = new Hono();

function recentMem(limit = 40): MemPaperPosition[] {
  const open = getOpenPositions();
  const closedish = memPaperPositions.filter(
    (p) => p.status !== "simulated_open" && p.status !== "alert_fired"
  );
  // Never truncate open holdings. Telegram paginates; only recent closed rows are capped.
  const merged = [...open, ...closedish.slice(0, Math.max(0, limit - open.length))];
  const seen = new Set<string>();
  const out: MemPaperPosition[] = [];
  for (const p of merged) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

positionRoutes.get("/", async (c) => {
  await hydrateOpenFromDb();
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
      markSource: r.currentPrice
        ? r.entryPrice && r.currentPrice === r.entryPrice
          ? ("stub_entry" as const)
          : ("manual" as const)
        : ("oracle_pending" as const),
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

/**
 * Set paper mark for unrealized PnL testing. Paper only — reject keys.
 * Body: { mark: string }. Optional source defaults to manual.
 * Best-effort mirrors mark to postgres current_price when DB present.
 */
positionRoutes.post("/:id/paper-mark", async (c) => {
  const id = c.req.param("id");
  const body: unknown = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid_json", paperOnly: true }, 400);

  // Reject any key / credential fields — paper mark only
  const forbidden = [
    "key",
    "privateKey",
    "private_key",
    "secret",
    "mnemonic",
    "seed",
    "wallet",
    "apiKey",
    "api_key",
  ];
  for (const k of forbidden) {
    if (k in body && body[k] != null && body[k] !== "") {
      return c.json(
        {
          error: "keys_rejected",
          paperOnly: true,
          note: "PAPER ONLY — do not send keys; paper-mark accepts { mark } only.",
        },
        400
      );
    }
  }

  const markRaw = body.mark;
  if (markRaw == null || String(markRaw).trim() === "") {
    return c.json(
      {
        error: "mark_required",
        paperOnly: true,
        note: "Body must be { mark: string } — paper only.",
      },
      400
    );
  }

  const sourceRaw = body.source;
  const mark = decimalText(markRaw, true);
  if (mark === null) {
    return c.json({ error: "invalid_mark", paperOnly: true, note: "Mark must be a finite non-negative decimal." }, 400);
  }
  const source: "manual" | "stub_entry" =
    sourceRaw === "stub_entry" ? "stub_entry" : "manual";

  // Ensure DB opens are in mem before mark (e.g. post-restart)
  await hydrateOpenFromDb();

  const pos = setPaperMark(id, mark, source);
  if (!pos) {
    return c.json(
      {
        error: "position_not_found",
        positionId: id,
        paperOnly: true,
      },
      404
    );
  }

  const db = getDb();
  if (db) {
    try {
      await db
        .update(positions)
        .set({ currentPrice: pos.currentPrice, pnlAbs: pos.pnlAbs, pnlPct: pos.pnlPct })
        .where(eq(positions.id, id));
    } catch (err) {
      console.warn(
        "[positions] paper-mark postgres update best-effort failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return c.json({
    data: toPositionPayload(pos),
    paperOnly: true,
    note: "PAPER mark set — unrealized PnL uses this mark; no keys; no live oracle.",
  });
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
