import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { auditLog, identityClaims, identityReviews, researchProjects, type Db } from "@rh/db";
import { evaluateIdentity, IDENTITY_MAX_AGE_MS, identityAddress, identitySourceUrl, type IdentityReport } from "@rh/core";
import { getDb } from "./db.js";
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export const identityEnabled = () => process.env.IDENTITY_GATE_ENABLED === "true";
export class IdentityError extends Error { constructor(message: string, readonly status: 400 | 404 | 409 | 503 = 409) { super(message); } }
export async function identityTransaction<T>(action: (tx: Tx) => Promise<T>) {
  const db = getDb(); if (!db) throw new IdentityError("identity_storage_unavailable", 503);
  return db.transaction(async tx => { await tx.execute(sql`SELECT pg_advisory_xact_lock(4663,9009)`); return action(tx); });
}
export async function proposalIdentity(tx: Tx, proposal: { projectHandle?: string | null; tokenAddress: string | null }) {
  const handle = proposal.projectHandle ?? null;
  const [project] = handle ? await tx.select().from(researchProjects).where(eq(researchProjects.handle, handle)).for("share") : [];
  const claims = project ? await tx.select().from(identityClaims).where(eq(identityClaims.projectHandle, project.handle)).orderBy(desc(identityClaims.createdAt)) : [];
  return evaluateIdentity({ projectHandle: handle, tokenAddress: proposal.tokenAddress ?? "", domain: project?.domain ?? null,
    enabled: project?.enabled ?? false, claims: claims.map(c => ({ ...c, report: c.report as IdentityReport | null })) });
}
export async function createIdentityClaim(body: Record<string, unknown>) {
  const allowed = ["projectHandle", "tokenAddress", "deployerAddress", "creationTxHash", "sourceUrl"];
  if (Object.keys(body).some(k => !allowed.includes(k)) || allowed.some(k => typeof body[k] !== "string")) throw new IdentityError("invalid_claim_fields",400);
  const handle = String(body.projectHandle).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle) || !/^0x[a-fA-F0-9]{64}$/.test(String(body.creationTxHash))) throw new IdentityError("invalid_claim_fields",400);
  let tokenAddress: string, deployerAddress: string;
  try { tokenAddress = identityAddress(body.tokenAddress); deployerAddress = identityAddress(body.deployerAddress); }
  catch { throw new IdentityError("invalid_claim_address",400); }
  return identityTransaction(async tx => {
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, handle)).for("share");
    if (!project) throw new IdentityError("project_not_found",404);
    let sourceUrl: string;
    try { sourceUrl = identitySourceUrl(body.sourceUrl, project.domain); } catch { throw new IdentityError("source_outside_project_domain",400); }
    const active = await tx.select().from(identityClaims).where(and(eq(identityClaims.projectHandle, handle), isNull(identityClaims.revokedAt)));
    const creationTxHash = String(body.creationTxHash).toLowerCase();
    const prior = active.find(c => c.tokenAddress === tokenAddress && c.deployerAddress === deployerAddress && c.creationTxHash === creationTxHash && c.sourceUrl === sourceUrl && c.domain === project.domain);
    if (prior) return prior;
    if (active.length >= 5) throw new IdentityError("too_many_active_claims_revoke_old_drafts");
    const [claim] = await tx.insert(identityClaims).values({ projectHandle: handle, domain: project.domain, tokenAddress, deployerAddress, creationTxHash, sourceUrl }).returning();
    await tx.insert(auditLog).values({ action: "identity_claim_drafted", actor: "research", detail: { claimId: claim.id, projectHandle: handle, tokenAddress } });
    return claim;
  });
}
export async function identityProject(handle: string) {
  return identityTransaction(async tx => {
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, handle));
    if (!project) throw new IdentityError("project_not_found",404);
    const claims = await tx.select().from(identityClaims).where(eq(identityClaims.projectHandle, handle)).orderBy(desc(identityClaims.createdAt)).limit(30);
    const token = claims.find(c => c.reviewedAt && !c.revokedAt)?.tokenAddress ?? claims[0]?.tokenAddress ?? "";
    return { project: { handle: project.handle, domain: project.domain, enabled: project.enabled }, claims,
      verdict: await proposalIdentity(tx, { projectHandle: handle, tokenAddress: token }) };
  });
}
export async function identityClaim(id: string) {
  return identityTransaction(async tx => {
    const [claim] = await tx.select().from(identityClaims).where(eq(identityClaims.id,id));
    if (!claim) throw new IdentityError("claim_not_found",404);
    return { claim, verdict: await proposalIdentity(tx,claim) };
  });
}
export async function previewIdentityReview(id: string, actor: string) {
  return identityTransaction(async tx => {
    const [claim] = await tx.select().from(identityClaims).where(eq(identityClaims.id,id));
    if (!claim) throw new IdentityError("claim_not_found",404);
    const report = claim.report as IdentityReport | null;
    if (claim.revokedAt) throw new IdentityError("claim_revoked");
    if (!report || report.source.status !== "matched" || !report.source.hash || !claim.checkedAt || Date.now()-claim.checkedAt.getTime()>IDENTITY_MAX_AGE_MS) throw new IdentityError("fresh_matching_source_required");
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle,claim.projectHandle)).for("share");
    if (project.domain !== claim.domain || !project.enabled) throw new IdentityError("project_changed_or_paused");
    const [review] = await tx.insert(identityReviews).values({ claimId: id, sourceHash: report.source.hash, actor, expiresAt: new Date(Date.now()+300_000) }).returning();
    return { review, claim };
  });
}
export async function confirmIdentityReview(id: string, actor: string) {
  return identityTransaction(async tx => {
    const [review] = await tx.select().from(identityReviews).where(eq(identityReviews.id,id));
    if (!review || review.actor !== actor) throw new IdentityError("review_not_found",404);
    if (review.status === "confirmed") return { confirmed: true, replayed: true };
    if (review.status !== "pending" || review.expiresAt.getTime()<=Date.now()) throw new IdentityError("review_expired");
    const [claim] = await tx.select().from(identityClaims).where(eq(identityClaims.id,review.claimId));
    const [project] = await tx.select().from(researchProjects).where(eq(researchProjects.handle,claim.projectHandle)).for("share");
    const report = claim.report as IdentityReport | null;
    if (claim.revokedAt || project.domain !== claim.domain || !project.enabled || report?.source.status !== "matched" || report.source.hash !== review.sourceHash ||
      !claim.checkedAt || Date.now()-claim.checkedAt.getTime()>IDENTITY_MAX_AGE_MS) throw new IdentityError("source_changed_refresh_review");
    await tx.update(identityClaims).set({ reviewedAt: new Date(), reviewedBy: actor, reviewedSourceHash: review.sourceHash }).where(eq(identityClaims.id,claim.id));
    await tx.update(identityReviews).set({ status: "confirmed" }).where(eq(identityReviews.id,id));
    await tx.insert(auditLog).values({ action: "identity_source_reviewed", actor, detail: { claimId: claim.id, sourceHash: review.sourceHash, reviewId: id } });
    return { confirmed: true, replayed: false, verdict: await proposalIdentity(tx, { projectHandle: claim.projectHandle, tokenAddress: claim.tokenAddress }) };
  });
}
export async function revokeIdentityClaim(id: string, actor: string) {
  return identityTransaction(async tx => {
    const [claim] = await tx.update(identityClaims).set({ revokedAt: new Date() }).where(eq(identityClaims.id,id)).returning();
    if (!claim) throw new IdentityError("claim_not_found",404);
    await tx.insert(auditLog).values({ action: "identity_claim_revoked", actor, detail: { claimId:id } });
    return { revoked: true, projectHandle: claim.projectHandle };
  });
}
