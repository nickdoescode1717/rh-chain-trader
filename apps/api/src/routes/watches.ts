import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { watchInput } from "@rh/core";
import { researchProjects, socialAccounts, watchTargets } from "@rh/db";
import { getDb } from "../db.js";
import { isRecord } from "../validation.js";
import { telegramDecisionError } from "../telegram-approval.js";

export const watchRoutes = new Hono();
watchRoutes.get("/", async c => {
  const db = getDb(); if (!db) return c.json({ error: "research_requires_postgres" }, 503);
  return c.json({ data: await db.select().from(watchTargets).orderBy(desc(watchTargets.createdAt)) });
});
watchRoutes.get("/:id", async c => {
  if (!/^[a-f0-9-]{36}$/.test(c.req.param("id"))) return c.json({ error: "invalid_id" }, 400);
  const db = getDb(); if (!db) return c.json({ error: "research_requires_postgres" }, 503);
  const [row] = await db.select().from(watchTargets).where(eq(watchTargets.id, c.req.param("id")));
  return row ? c.json({ data: row }) : c.json({ error: "watch_not_found" }, 404);
});
watchRoutes.post("/", async c => {
  const body = await c.req.json().catch(() => null);
  const auth = telegramDecisionError(c.req.header("x-telegram-approval-token"), body?.actor);
  if (auth) return c.json({ error: auth.error }, auth.status);
  if (!isRecord(body) || typeof body.input !== "string" || Object.keys(body).some(k => !["input", "actor"].includes(k))) return c.json({ error: "invalid_watch_input" }, 400);
  let parsed; try { parsed = watchInput(body.input); } catch { return c.json({ error: "invalid_watch_input" }, 400); }
  const db = getDb(); if (!db) return c.json({ error: "research_requires_postgres" }, 503);
  const data = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663, 9011)`);
    const [old] = await tx.select().from(watchTargets).where(eq(watchTargets.inputKey, parsed.key));
    const projects = await tx.select().from(researchProjects).where(parsed.handle
      ? eq(researchProjects.handle, parsed.handle) : eq(researchProjects.domain, parsed.domain!));
    const project = projects.length === 1 ? projects[0] : undefined;
    const projectHandle = old?.projectHandle ?? project?.handle ?? null;
    if (projectHandle) {
      await tx.update(researchProjects).set({ enabled: true }).where(eq(researchProjects.handle, projectHandle));
      await tx.update(socialAccounts).set({ enabled: true }).where(eq(socialAccounts.handle, projectHandle));
      await tx.update(watchTargets).set({ enabled: true, revision: sql`${watchTargets.revision} + 1` }).where(and(eq(watchTargets.projectHandle, projectHandle), eq(watchTargets.enabled, false)));
    }
    const [saved] = await tx.insert(watchTargets).values({ inputKey: parsed.key, handle: parsed.handle, domain: parsed.domain, projectHandle })
      .onConflictDoUpdate({ target: watchTargets.inputKey, set: { enabled: true,
        revision: sql`case when ${watchTargets.enabled} then ${watchTargets.revision} else ${watchTargets.revision} + 1 end` } }).returning();
    return saved;
  });
  return c.json({ data }, 201);
});
watchRoutes.post("/:id/monitoring", async c => {
  const body = await c.req.json().catch(() => null);
  const auth = telegramDecisionError(c.req.header("x-telegram-approval-token"), body?.actor);
  if (auth) return c.json({ error: auth.error }, auth.status);
  if (!/^[a-f0-9-]{36}$/.test(c.req.param("id")) || !isRecord(body) || typeof body.enabled !== "boolean"
    || Object.keys(body).some(k => !["enabled", "actor"].includes(k))) return c.json({ error: "invalid_watch_input" }, 400);
  const db = getDb(); if (!db) return c.json({ error: "research_requires_postgres" }, 503);
  const data = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663, 9011)`);
    const [row] = await tx.update(watchTargets).set({ enabled: body.enabled as boolean, revision: sql`${watchTargets.revision} + 1` })
      .where(eq(watchTargets.id, c.req.param("id"))).returning();
    if (row?.projectHandle) {
      await tx.update(researchProjects).set({ enabled: body.enabled as boolean }).where(eq(researchProjects.handle, row.projectHandle));
      await tx.update(socialAccounts).set({ enabled: body.enabled as boolean }).where(eq(socialAccounts.handle, row.projectHandle));
      await tx.update(watchTargets).set({ enabled: body.enabled as boolean, revision: sql`${watchTargets.revision} + 1` }).where(eq(watchTargets.projectHandle, row.projectHandle));
    }
    return row;
  });
  return data ? c.json({ data }) : c.json({ error: "watch_not_found" }, 404);
});

