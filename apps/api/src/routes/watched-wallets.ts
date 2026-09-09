/**
 * Watched-wallet CRUD (research / paper only).
 * Empty list is valid — Nick adds addresses later.
 * /watchlist remains the TOKEN watchlist; this is separate.
 */
import { Hono } from "hono";
import { eq, or } from "drizzle-orm";
import { wallets } from "@rh/db";
import { getDb } from "../db.js";
import { memWallets, type MemWallet } from "../memory-store.js";

export const watchedWalletRoutes = new Hono();

const ADDR_RE = /^0x[0-9a-f]{40}$/;

function normalizeAddress(raw: string): string | null {
  const a = raw.trim().toLowerCase();
  return ADDR_RE.test(a) ? a : null;
}

watchedWalletRoutes.get("/", async (c) => {
  const db = getDb();
  if (!db) {
    return c.json({ data: [...memWallets], source: "memory" });
  }
  const rows = await db.select().from(wallets);
  return c.json({ data: rows, source: "postgres" });
});

watchedWalletRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    address?: string;
    label?: string | null;
    tags?: string[];
    notes?: string | null;
  } | null;

  if (!body?.address) {
    return c.json({ error: "address_required" }, 400);
  }
  const address = normalizeAddress(body.address);
  if (!address) {
    return c.json({ error: "invalid_address" }, 400);
  }

  const label = body.label ?? null;
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const notes = body.notes ?? null;

  const db = getDb();
  if (!db) {
    const existing = memWallets.find((w) => w.address === address);
    if (existing) {
      existing.label = label;
      existing.tags = tags;
      existing.notes = notes;
      return c.json({ data: existing, source: "memory", upserted: true });
    }
    const row: MemWallet = {
      id: crypto.randomUUID(),
      address,
      label,
      tags,
      notes,
      createdAt: new Date().toISOString(),
    };
    memWallets.push(row);
    return c.json({ data: row, source: "memory", upserted: true }, 201);
  }

  const [row] = await db
    .insert(wallets)
    .values({ address, label, tags, notes })
    .onConflictDoUpdate({
      target: wallets.address,
      set: { label, tags, notes },
    })
    .returning();

  return c.json({ data: row, source: "postgres", upserted: true });
});

watchedWalletRoutes.delete("/:key", async (c) => {
  const key = c.req.param("key");
  const asAddr = normalizeAddress(key);
  const db = getDb();

  if (!db) {
    const idx = memWallets.findIndex(
      (w) => w.id === key || (asAddr !== null && w.address === asAddr)
    );
    if (idx < 0) return c.json({ error: "not_found" }, 404);
    const [removed] = memWallets.splice(idx, 1);
    return c.json({ data: removed, source: "memory" });
  }

  const cond =
    asAddr !== null
      ? or(eq(wallets.id, key), eq(wallets.address, asAddr))
      : eq(wallets.id, key);

  const [removed] = await db.delete(wallets).where(cond!).returning();
  if (!removed) return c.json({ error: "not_found" }, 404);
  return c.json({ data: removed, source: "postgres" });
});
