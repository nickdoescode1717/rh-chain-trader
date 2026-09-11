import { Hono } from "hono";
import { decideSnipe, draftSnipe, listSnipes } from "../snipes.js";
import { LedgerError } from "../paper-ledger.js";
import { telegramDecisionError } from "../telegram-approval.js";
import { isRecord } from "../validation.js";
export const snipeRoutes = new Hono();
snipeRoutes.onError((err, c) => c.json({ error: err instanceof LedgerError ? err.message : "paper_snipe_unavailable" }, err instanceof LedgerError ? err.status : 503));
snipeRoutes.get("/", async c => c.json({ data: await listSnipes(), paperOnly: true }));
snipeRoutes.post("/", async c => {
  const body = await c.req.json().catch(() => null);
  const auth = telegramDecisionError(c.req.header("x-telegram-approval-token"), body?.actor);
  if (auth) return c.json({ error: auth.error }, auth.status);
  if (!isRecord(body)) return c.json({ error: "invalid_plan" }, 400);
  return c.json({ data: await draftSnipe(body, body.actor as string), paperOnly: true }, 201);
});
snipeRoutes.post("/:id/:action", async c => {
  const body = await c.req.json().catch(() => null), action = c.req.param("action"), id = c.req.param("id");
  const auth = telegramDecisionError(c.req.header("x-telegram-approval-token"), body?.actor);
  if (auth) return c.json({ error: auth.error }, auth.status);
  if (!isRecord(body) || Object.keys(body).some(k => k !== "actor") || !/^[a-f0-9-]{36}$/.test(id) || !["arm", "cancel"].includes(action)) return c.json({ error: "invalid_plan_action" }, 400);
  return c.json({ data: await decideSnipe(id, action as "arm" | "cancel", body.actor as string), paperOnly: true });
});
