import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { tokens, scores, evidence } from "@rh/db";
import { getDb } from "../db.js";
import { memTokens, memScores, memEvidence } from "../memory-store.js";

export const tokenRoutes = new Hono();

tokenRoutes.get("/", async (c) => {
  const db = getDb();
  if (!db) {
    return c.json({
      data: memTokens.map((t) => ({
        ...t,
        latestScore: memScores.find((s) => s.tokenId === t.id) ?? null,
        dataLabel: "FICTIONAL",
      })),
      source: "memory_fictional",
    });
  }

  const rows = await db.select().from(tokens).orderBy(desc(tokens.createdAt));
  const scoreRows = await db.select().from(scores);
  const data = rows.map((t) => ({
    ...t,
    latestScore:
      scoreRows
        .filter((s) => s.tokenId === t.id)
        .sort(
          (a, b) =>
            new Date(b.scoredAt).getTime() - new Date(a.scoredAt).getTime()
        )[0] ?? null,
  }));
  return c.json({ data, source: "postgres" });
});

tokenRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  if (!db) {
    const token =
      memTokens.find((t) => t.id === id || t.address.toLowerCase() === id.toLowerCase()) ??
      null;
    if (!token) return c.json({ error: "not_found" }, 404);
    return c.json({
      data: {
        ...token,
        scores: memScores.filter((s) => s.tokenId === token.id),
        evidence: memEvidence.filter((e) => e.tokenId === token.id),
        dataLabel: "FICTIONAL",
        blockscoutUrl: `https://robinhoodchain.blockscout.com/token/${token.address}`,
      },
      source: "memory_fictional",
    });
  }

  const [token] = await db
    .select()
    .from(tokens)
    .where(eq(tokens.id, id))
    .limit(1);

  let resolved = token;
  if (!resolved) {
    const byAddr = await db
      .select()
      .from(tokens)
      .where(eq(tokens.address, id))
      .limit(1);
    resolved = byAddr[0];
  }
  if (!resolved) return c.json({ error: "not_found" }, 404);

  const tokenScores = await db
    .select()
    .from(scores)
    .where(eq(scores.tokenId, resolved.id))
    .orderBy(desc(scores.scoredAt));
  const tokenEvidence = await db
    .select()
    .from(evidence)
    .where(eq(evidence.tokenId, resolved.id));

  return c.json({
    data: {
      ...resolved,
      scores: tokenScores,
      evidence: tokenEvidence,
      blockscoutUrl: `https://robinhoodchain.blockscout.com/token/${resolved.address}`,
    },
    source: "postgres",
  });
});
