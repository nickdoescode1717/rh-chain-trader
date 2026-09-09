import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { tokens, scores } from "@rh/db";
import { getDb } from "../db.js";
import { memTokens, memScores } from "../memory-store.js";

export const watchlistRoutes = new Hono();

watchlistRoutes.get("/", async (c) => {
  const db = getDb();
  if (!db) {
    const watched = memTokens.filter((t) => t.isWatchlisted);
    return c.json({
      data: watched.map((t) => ({
        ...t,
        latestScore: memScores.find((s) => s.tokenId === t.id) ?? null,
        dataLabel: "FICTIONAL",
      })),
      source: "memory_fictional",
    });
  }

  const rows = await db
    .select()
    .from(tokens)
    .where(eq(tokens.isWatchlisted, true));
  const scoreRows = await db.select().from(scores);
  return c.json({
    data: rows.map((t) => ({
      ...t,
      latestScore:
        scoreRows
          .filter((s) => s.tokenId === t.id)
          .sort(
            (a, b) =>
              new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime()
          )[0] ?? null,
    })),
    source: "postgres",
  });
});

watchlistRoutes.post("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  if (!db) {
    const t = memTokens.find((x) => x.id === id);
    if (!t) return c.json({ error: "not_found" }, 404);
    t.isWatchlisted = true;
    return c.json({ data: t, source: "memory_fictional" });
  }
  const [updated] = await db
    .update(tokens)
    .set({ isWatchlisted: true })
    .where(eq(tokens.id, id))
    .returning();
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ data: updated, source: "postgres" });
});

watchlistRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  if (!db) {
    const t = memTokens.find((x) => x.id === id);
    if (!t) return c.json({ error: "not_found" }, 404);
    t.isWatchlisted = false;
    return c.json({ data: t, source: "memory_fictional" });
  }
  const [updated] = await db
    .update(tokens)
    .set({ isWatchlisted: false })
    .where(eq(tokens.id, id))
    .returning();
  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json({ data: updated, source: "postgres" });
});
