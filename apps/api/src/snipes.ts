import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { auditLog, identityClaims, marketQuotes, paperAccounts, paperSnipes, positions, purchaseProposals, researchProjects } from "@rh/db";
import { decimal, quoteUsable, simulateBuy, snipeTerms, units, type IdentityReport, type MarketQuote } from "@rh/core";
import { getDb } from "./db.js";
import { identityEnabled, proposalIdentity } from "./identity.js";
import { ledgerEnabled, LedgerError, reservedSnipeEth, settleLedgerBuy, withLedger } from "./paper-ledger.js";
export const snipesEnabled = () => process.env.PAPER_SNIPER_ENABLED === "true" && ledgerEnabled() && identityEnabled();
const required = () => { if (!snipesEnabled()) throw new LedgerError("paper_sniper_unavailable", 503); };
export async function listSnipes() {
  required(); const db = getDb(); if (!db) throw new LedgerError("paper_storage_unavailable", 503);
  return db.select().from(paperSnipes).orderBy(sql`case when ${paperSnipes.status} = 'armed' then 0 else 1 end`, desc(paperSnipes.createdAt)).limit(50);
}
export async function draftSnipe(body: Record<string, unknown>, actor: string) {
  required();
  return withLedger(async tx => {
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, String(body.projectHandle)));
    if (!project) throw new LedgerError("watch_project_first", 404);
    let terms; try { terms = snipeTerms(body, project.domain); } catch (e) { throw new LedgerError((e as Error).message, 400); }
    const existing = await tx.select().from(paperSnipes).where(eq(paperSnipes.createdBy, actor));
    const same = existing.find(p => ["draft", "armed"].includes(p.status) && Object.entries(terms).every(([k,v]) => p.terms[k as keyof typeof terms] === v)
      && (p.status === "armed" ? p.expiresAt!.getTime() > Date.now() : Date.now() - p.createdAt.getTime() < 600_000));
    if (same) return same;
    const [plan] = await tx.insert(paperSnipes).values({ terms, createdBy: actor }).returning();
    await tx.insert(auditLog).values({ action: "paper_snipe_drafted", actor, detail: { planId: plan.id, terms } });
    return plan;
  });
}
export async function decideSnipe(id: string, action: "arm" | "cancel", actor: string) {
  required();
  return withLedger(async tx => {
    const [plan] = await tx.select().from(paperSnipes).where(eq(paperSnipes.id, id)).for("update");
    if (!plan || plan.createdBy !== actor) throw new LedgerError("snipe_not_found", 404);
    if (action === "cancel") {
      if (plan.status === "filled") throw new LedgerError("snipe_already_filled");
      const [saved] = await tx.update(paperSnipes).set({ status: "cancelled", reason: "owner_cancelled" }).where(eq(paperSnipes.id, id)).returning();
      return saved;
    }
    if (plan.status === "armed" && plan.expiresAt!.getTime() > Date.now()) return plan;
    if (plan.status !== "draft" || Date.now() - plan.createdAt.getTime() > 600_000) throw new LedgerError("plan_review_expired_create_again");
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, plan.terms.projectHandle));
    if (!project?.enabled || project.domain !== plan.terms.domain) throw new LedgerError("project_changed_or_paused");
    const [control] = await tx.execute(sql`select paused,chain_enabled from collection_control where id=1 for share`);
    if (!control || control.paused || !control.chain_enabled) throw new LedgerError("enable_chain_collection_before_arming");
    const armed = await tx.select().from(paperSnipes).where(and(eq(paperSnipes.status, "armed"), sql`${paperSnipes.expiresAt} > now()`));
    if (armed.length >= 5) throw new LedgerError("maximum_five_armed_plans");
    if (armed.some(p => p.terms.projectHandle === plan.terms.projectHandle)) throw new LedgerError("project_already_has_armed_plan");
    const [account] = await tx.select().from(paperAccounts).where(eq(paperAccounts.currency, "ETH"));
    if (units(account.cash) - await reservedSnipeEth(tx) < units(plan.terms.spendEth)) throw new LedgerError("insufficient_unreserved_paper_cash");
    const armedAt = new Date(), expiresAt = new Date(armedAt.getTime() + plan.terms.hours * 3_600_000);
    const [saved] = await tx.update(paperSnipes).set({ status: "armed", armedAt, expiresAt, reason: "waiting_for_verified_mainnet_launch" }).where(eq(paperSnipes.id, id)).returning();
    await tx.insert(auditLog).values({ action: "paper_snipe_armed", actor, detail: { planId: id, terms: plan.terms, expiresAt: expiresAt.toISOString() } });
    return saved;
  });
}

/** Every gate, reservation and fill commits under the same book lock; collection row locks serialize /stop. */
export async function evaluateSnipe(id: string) {
  required();
  return withLedger(async tx => {
    const [p] = await tx.select().from(paperSnipes).where(eq(paperSnipes.id, id)).for("update");
    if (!p || p.status !== "armed") return p;
    const save = async (reason: string, status = "armed", tokenAddress: string | null = p.tokenAddress) => {
      const [saved] = await tx.update(paperSnipes).set({ reason, status, tokenAddress, checkedAt: new Date() }).where(eq(paperSnipes.id, id)).returning(); return saved;
    };
    if (!p.expiresAt || p.expiresAt.getTime() <= Date.now()) return save("plan_expired", "expired");
    const [control] = await tx.execute(sql`select paused,chain_enabled,rpc_blocked_until > now() as cooldown from collection_control where id=1 for share`);
    if (!control || control.paused || !control.chain_enabled) return save("collection_disabled", "cancelled");
    if (control.cooldown) return save("rpc_provider_cooldown");
    const [usage] = await tx.execute(sql`select coalesce(sum(attempts),0)::int as used from rpc_usage where day=to_char(now() at time zone 'UTC','YYYY-MM-DD')`);
    if (Number(usage.used) >= 2000) return save("rpc_daily_limit_reached");
    const t = p.terms;
    if (t.mode !== "paper" || t.chainId !== 4663) return save("unsupported_execution_network", "cancelled");
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, t.projectHandle)).for("share");
    if (!project?.enabled || project.domain !== t.domain) return save("project_changed_or_paused", "cancelled");
    const claims = await tx.select().from(identityClaims).where(and(eq(identityClaims.projectHandle, t.projectHandle), isNull(identityClaims.revokedAt)));
    const reviewed = claims.filter(c => c.reviewedAt);
    if (reviewed.length !== 1) return save("one_reviewed_mainnet_identity_required");
    const claim = reviewed[0], token = claim.tokenAddress;
    if (claim.deployerAddress !== t.deployerAddress) return save("deployer_does_not_match_approved_plan", "armed", token);
    const identity = await proposalIdentity(tx, { projectHandle: t.projectHandle, tokenAddress: token });
    if (identity.status !== "verified") return save(`identity_${identity.status}`, "armed", token);
    const born = (claim.report as IdentityReport | null)?.chain.blockTimestamp;
    if (!born || born * 1000 < p.armedAt!.getTime() || born * 1000 > Date.now()) return save("deployment_must_follow_arming", "armed", token);
    if (Date.now() - born * 1000 > t.maxLaunchAgeSeconds * 1000) return save("launch_entry_window_expired", "expired", token);
    const [held] = await tx.select().from(positions).where(and(eq(positions.tokenAddress, token), sql`${positions.status} <> 'closed'`)).limit(1);
    const [bought] = await tx.select().from(paperSnipes).where(and(eq(paperSnipes.tokenAddress, token), eq(paperSnipes.status, "filled"))).limit(1);
    if (held || bought) return save("token_already_bought", "cancelled", token);
    const [cached] = await tx.select().from(marketQuotes).where(eq(marketQuotes.tokenAddress, token));
    const q = cached?.quote as MarketQuote | null;
    if (!cached || cached.lastError || !quoteUsable(q, token, Date.now(), 90_000)) return save("waiting_for_fresh_tradable_quote", "armed", token);
    if (!Number.isFinite(q!.liquidityUsd) || q!.liquidityUsd < t.minLiquidityUsd) return save("insufficient_liquidity", "armed", token);
    if (units(simulateBuy(t.spendEth, String(q!.priceEth)).executionPrice) > units(t.maxUnitPriceEth)) return save("price_above_approved_limit", "armed", token);
    const [proposal] = await tx.insert(purchaseProposals).values({ projectHandle: t.projectHandle, tokenAddress: token,
      size: `eth:${t.spendEth}`, slippageBps: t.slippageBps, status: "pending_snipe", channel: "telegram", expiresAt: p.expiresAt,
      rationale: "Single paper entry under immutable Telegram-approved launch plan", sources: [{ claimId: claim.id, planId: id }], note: "PAPER_SNIPE_PENDING_SETTLEMENT" }).returning();
    const result = await settleLedgerBuy(tx, proposal.id, p.createdBy, id);
    const [filled] = await tx.update(paperSnipes).set({ status: "filled", reason: "paper_fill_recorded", tokenAddress: token,
      proposalId: proposal.id, fillId: result.fill.id, checkedAt: new Date() }).where(eq(paperSnipes.id, id)).returning();
    await tx.insert(auditLog).values({ action: "paper_snipe_filled", actor: p.createdBy, detail: { planId: id, fillId: result.fill.id, terms: t } });
    return filled;
  });
}
export async function tickSnipes() {
  if (!snipesEnabled()) return;
  const db = getDb(); if (!db) return;
  const plans = await db.select().from(paperSnipes).where(eq(paperSnipes.status, "armed"));
  for (const p of plans) { try { await evaluateSnipe(p.id); } catch { console.warn("[paper-snipe] settlement deferred; no partial fill committed"); } }
}
