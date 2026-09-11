import { Hono } from "hono";
import { cancelSell, confirmSell, fillHistory, ledgerEnabled, LedgerError, previewSell } from "../paper-ledger.js";
import { telegramDecisionError } from "../telegram-approval.js";
import { isRecord } from "../validation.js";
export const paperSellRoutes = new Hono();
paperSellRoutes.get("/history", async c => {
  if (!ledgerEnabled()) return c.json({ error: "paper_ledger_disabled" }, 503);
  try { return c.json({ data: await fillHistory(), paperOnly: true }); }
  catch { return c.json({ error: "paper_history_unavailable" }, 503); }
});
paperSellRoutes.post("/:id/:action", async c => {
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid_json" }, 400);
  const denied = telegramDecisionError(c.req.header("x-telegram-approval-token"), body.actor);
  if (denied) return c.json({ error: denied.error }, denied.status);
  if (!ledgerEnabled()) return c.json({ error: "paper_ledger_disabled" }, 503);
  const id = c.req.param("id"), action = c.req.param("action");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      Object.keys(body).some(k => !["actor", ...(action === "preview" ? ["percent"] : [])].includes(k))) return c.json({ error: "invalid_request" }, 400);
  try {
    const actor = body.actor as string;
    const data = action === "preview" ? await previewSell(id, body.percent as number, actor)
      : action === "confirm" ? await confirmSell(id, actor) : action === "cancel" ? await cancelSell(id, actor) : null;
    if (!data) return c.json({ error: "unknown_action" }, 404);
    return c.json({ data, paperOnly: true, signed: false, txSubmitted: false });
  } catch (e) { return c.json({ error: e instanceof LedgerError ? e.message : "paper_settlement_unavailable" }, e instanceof LedgerError ? e.status : 503); }
});
