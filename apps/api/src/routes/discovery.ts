import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { socialAccounts, socialSignals, tokens, evidence } from "@rh/db";
import { getDb } from "../db.js";
import { isRecord } from "../validation.js";

export const discoveryRoutes = new Hono();

function graphCoverage(value: unknown) {
  if (!isRecord(value)) return null;
  return { baselineCount: Array.isArray(value.baseline) ? value.baseline.length : null,
    pendingCount: Array.isArray(value.pending) ? value.pending.length : 0,
    scanning: Boolean(value.nextToken), truncated: value.truncated === true,
    lastCompletedAt: value.lastCompletedAt ?? null };
}

discoveryRoutes.get("/accounts", async (c) => {
  const db = getDb();
  if (!db) return c.json({ error: "discovery_requires_postgres", data: [] }, 503);
  const rows = await db.select().from(socialAccounts).orderBy(desc(socialAccounts.createdAt));
  return c.json({ data: rows.map(({ state, ...account }) => ({
    ...account,
    coverage: {
      postsBacklog: Boolean(state.postNextToken),
      following: graphCoverage(state.following), followers: graphCoverage(state.followers),
    },
  })), paperOnly: true });
});

discoveryRoutes.post("/accounts", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (!isRecord(body) || typeof body.handle !== "string") return c.json({ error: "handle_required" }, 400);
  const allowed = new Set(["handle", "label", "enabled", "watchFollowing", "watchFollowers"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return c.json({ error: "unknown_fields", allowed: [...allowed] }, 400);
  const handle = body.handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) return c.json({ error: "invalid_handle" }, 400);
  if (body.label != null && (typeof body.label !== "string" || body.label.length > 200)) return c.json({ error: "invalid_label" }, 400);
  for (const field of ["enabled", "watchFollowing", "watchFollowers"]) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") return c.json({ error: `invalid_${field}` }, 400);
  }
  const db = getDb();
  if (!db) return c.json({ error: "discovery_requires_postgres" }, 503);
  const values = {
    handle, label: body.label as string | null | undefined,
    enabled: body.enabled as boolean | undefined,
    watchFollowing: body.watchFollowing as boolean | undefined,
    watchFollowers: body.watchFollowers as boolean | undefined,
  };
  const [row] = await db.insert(socialAccounts).values(values)
    .onConflictDoUpdate({ target: socialAccounts.handle, set: values }).returning();
  return c.json({ data: { id: row.id, handle: row.handle, enabled: row.enabled }, paperOnly: true }, 201);
});

discoveryRoutes.get("/signals", async (c) => {
  const db = getDb();
  if (!db) return c.json({ error: "discovery_requires_postgres", data: [] }, 503);
  const limit = Number(c.req.query("limit") ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return c.json({ error: "limit_must_be_1_to_500" }, 400);
  const rows = await db.select({ signal: socialSignals, handle: socialAccounts.handle })
    .from(socialSignals).innerJoin(socialAccounts, eq(socialSignals.accountId, socialAccounts.id))
    .orderBy(desc(socialSignals.observedAt)).limit(limit);
  return c.json({ data: rows.map(({ signal, handle }) => ({ ...signal, handle })), paperOnly: true });
});

discoveryRoutes.get("/launch-matches", async (c) => {
  const db = getDb();
  if (!db) return c.json({ error: "discovery_requires_postgres", data: [] }, 503);
  const signals = await db.select().from(socialSignals).orderBy(desc(socialSignals.observedAt)).limit(500);
  const addresses = [...new Set(signals.flatMap((s) => s.addresses))];
  if (!addresses.length) return c.json({ data: [], paperOnly: true, autoBuyEnabled: false });
  const observedTokens = await db.select().from(tokens).where(and(eq(tokens.chainId, 4663), inArray(tokens.address, addresses)));
  const tokenIds = observedTokens.map((t) => t.id);
  const launches = tokenIds.length ? await db.select().from(evidence)
    .where(and(inArray(evidence.tokenId, tokenIds), eq(evidence.source, "onchain"))) : [];
  const matches = observedTokens.flatMap((token) => {
    const launchEvidence = launches.filter((row) => {
      if (row.tokenId !== token.id) return false;
      try {
        const body = JSON.parse(row.body);
        return ["pons-v2-factory", "pools-trade-entry-current", "pools-trade-entry-original"].includes(body.sourceId)
          && String(body.token).toLowerCase() === token.address;
      } catch { return false; }
    });
    if (!launchEvidence.length) return [];
    return [{ token, socialEvidence: signals.filter((s) => s.addresses.includes(token.address)),
      launchEvidence, status: "address_matches_observed_launch", autoBuyEligible: false,
      blockers: ["issuer_and_deployer_relationship_unverified", "sellability_and_liquidity_checks_required",
        "purchase_limits_and_execution_policy_required", "isolated_signer_not_connected"] }];
  });
  return c.json({ data: matches, paperOnly: true, autoBuyEnabled: false,
    note: "Exact address correlation over the latest 500 signals, not issuer verification or an investment score." });
});
