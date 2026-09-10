import { Hono } from "hono";
import { confirmIdentityReview, createIdentityClaim, identityProject, identityClaim, IdentityError, previewIdentityReview, revokeIdentityClaim } from "../identity.js";
import { isRecord } from "../validation.js";
import { telegramDecisionError } from "../telegram-approval.js";
export const identityRoutes = new Hono();
identityRoutes.get("/claims/:id", async c => {
  const id=c.req.param("id");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return c.json({error:"invalid_id"},400);
  try { return c.json({data:await identityClaim(id)}); }
  catch(e) { return c.json({error:e instanceof IdentityError ? e.message : "identity_unavailable"},e instanceof IdentityError ? e.status : 503); }
});
identityRoutes.get("/projects/:handle", async c => {
  const handle = c.req.param("handle").replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) return c.json({ error:"invalid_handle" },400);
  try { return c.json({ data:await identityProject(handle), paperOnly:true }); }
  catch(e) { return c.json({ error:e instanceof IdentityError ? e.message : "identity_unavailable" },e instanceof IdentityError ? e.status : 503); }
});
identityRoutes.post("/claims", async c => {
  const body = await c.req.json().catch(()=>null);
  if (!isRecord(body)) return c.json({ error:"invalid_json" },400);
  try { return c.json({ data:await createIdentityClaim(body), note:"Draft only. No trust or trade approval granted." },201); }
  catch(e) { return c.json({ error:e instanceof IdentityError ? e.message : "identity_unavailable" },e instanceof IdentityError ? e.status : 503); }
});
identityRoutes.post("/:id/:action", async c => {
  const body = await c.req.json().catch(()=>null);
  if (!isRecord(body) || Object.keys(body).some(k=>k!=="actor")) return c.json({ error:"invalid_json" },400);
  const denied = telegramDecisionError(c.req.header("x-telegram-approval-token"),body.actor);
  if (denied) return c.json({error:denied.error},denied.status);
  const id=c.req.param("id"), action=c.req.param("action");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return c.json({error:"invalid_id"},400);
  try {
    const data=action==="review" ? await previewIdentityReview(id,body.actor as string) : action==="confirm" ? await confirmIdentityReview(id,body.actor as string)
      : action==="revoke" ? await revokeIdentityClaim(id,body.actor as string) : null;
    if (!data) return c.json({error:"unknown_action"},404);
    return c.json({data,paperOnly:true});
  } catch(e) { return c.json({error:e instanceof IdentityError ? e.message : "identity_unavailable"},e instanceof IdentityError ? e.status : 503); }
});
