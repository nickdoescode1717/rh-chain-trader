import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { protocols } from "@rh/db";
import { getDb } from "../db.js";
import { memProtocols } from "../memory-store.js";

export const protocolRoutes = new Hono();

protocolRoutes.get("/", async (c) => {
  const db = getDb();
  if (!db) {
    return c.json({
      data: memProtocols.map((p) => ({
        ...p,
        factoryAddressStatus: p.factoryAddress
          ? "set"
          : "NEEDS_ONCHAIN_VERIFICATION",
        dataLabel: "FICTIONAL_SEED",
      })),
      source: "memory_fictional",
      chainId: 4663,
    });
  }

  const rows = await db.select().from(protocols);
  return c.json({
    data: rows.map((p) => ({
      ...p,
      factoryAddressStatus: p.factoryAddress
        ? "set"
        : "NEEDS_ONCHAIN_VERIFICATION",
    })),
    source: "postgres",
    chainId: 4663,
  });
});

protocolRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = getDb();
  if (!db) {
    const p = memProtocols.find((x) => x.slug === slug || x.id === slug);
    if (!p) return c.json({ error: "not_found" }, 404);
    return c.json({
      data: {
        ...p,
        factoryAddressStatus: "NEEDS_ONCHAIN_VERIFICATION",
        dataLabel: "FICTIONAL_SEED",
      },
      source: "memory_fictional",
    });
  }

  const [row] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.slug, slug))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({
    data: {
      ...row,
      factoryAddressStatus: row.factoryAddress
        ? "set"
        : "NEEDS_ONCHAIN_VERIFICATION",
    },
    source: "postgres",
  });
});
