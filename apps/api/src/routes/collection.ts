import { Hono } from "hono";
import { collectionState, changeCollection } from "@rh/db";
import { getDb } from "../db.js";
import { telegramDecisionError } from "../telegram-approval.js";
export const collectionRoutes = new Hono();
collectionRoutes.get("/", async c => {
  const db = getDb(); if (!db) return c.json({ error: "collection_unavailable" },503);
  return c.json({ data: await collectionState(db) });
});
collectionRoutes.post("/", async c => {
  const body = await c.req.json().catch(()=>null);
  const auth = telegramDecisionError(c.req.header("x-telegram-approval-token"),body?.actor);
  if (auth) return c.json({error:auth.error},auth.status);
  if (!body || !["stop","run","chainon","chainoff"].includes(body.action) || Object.keys(body).some(k=>!["action","actor"].includes(k))) return c.json({error:"invalid_collection_action"},400);
  const db=getDb();if(!db)return c.json({error:"collection_unavailable"},503);
  return c.json({ data: await changeCollection(db,body.action,body.actor) });
});
