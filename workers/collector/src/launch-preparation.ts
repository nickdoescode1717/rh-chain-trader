import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { auditLog, createDb, identityClaims, launchDeployments, researchProjects, watchTargets, type Db } from "@rh/db";
import { freshLaunchCandidates, identitySourceUrl, PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED, type LaunchMatch } from "@rh/core";
import type { RpcLog } from "./rpc.js";
import { collectionPermit, waitForCollection } from "./collection-control.js";

/** Strict event envelope only. Canonical receipt and issuer checks still belong to the identity gate. */
export function ponsDeployment(log: RpcLog, chainId: number) {
  if (chainId !== 4663 || log.removed || log.address.toLowerCase() !== PONS_V2_LAUNCH_FACTORY.toLowerCase()
    || log.topics.length !== 4 || log.topics[0].toLowerCase() !== PONS_V2_TOKEN_LAUNCHED.toLowerCase()
    || !log.topics.slice(1).every(t => /^0x0{24}[a-f0-9]{40}$/i.test(t) && !/^0x0{64}$/i.test(t))
    || !/^0x[a-f0-9]{64}$/i.test(log.transactionHash) || !/^0x[a-f0-9]{64}$/i.test(log.blockHash ?? "")
    || !/^0x[a-f0-9]+$/i.test(log.blockNumber)) return null;
  const blockNumber = Number.parseInt(log.blockNumber, 16);
  if (!Number.isSafeInteger(blockNumber) || blockNumber > 2147483647) return null;
  return { chainId, tokenAddress: `0x${log.topics[1].slice(-40)}`.toLowerCase(),
    deployerAddress: `0x${log.topics[3].slice(-40)}`.toLowerCase(), creationTxHash: log.transactionHash.toLowerCase(),
    factory: PONS_V2_LAUNCH_FACTORY.toLowerCase(), blockNumber, blockHash: log.blockHash!.toLowerCase() };
}
export async function recordLaunchDeployment(db: Db, log: RpcLog, chainId: number) {
  const deployment = ponsDeployment(log, chainId);
  if (deployment) await db.insert(launchDeployments).values(deployment).onConflictDoNothing();
}

/** DB-only reconciliation reuses existing factory ingestion; no extra Alchemy polling. */
export async function reconcileLaunchWatches(db: Db) {
  await collectionPermit();
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663, 9011)`);
    await tx.execute(sql`select pg_advisory_xact_lock(4663, 9009)`);
    const watches = await tx.select().from(watchTargets).where(and(eq(watchTargets.launchFlag, true), eq(watchTargets.enabled, true)));
    for (const watch of watches) {
      const report = watch.launchReport; if (!report || watch.lastError === "scan_in_progress") continue;
      const candidates = freshLaunchCandidates(report), tokens = candidates.filter(c => c.role === "token"), deployers = candidates.filter(c => c.role === "deployer");
      const deployments = tokens.length || deployers.length ? await tx.select().from(launchDeployments).where(or(
        tokens.length ? inArray(launchDeployments.tokenAddress, tokens.map(c => c.address)) : undefined,
        deployers.length ? inArray(launchDeployments.deployerAddress, deployers.map(c => c.address)) : undefined))
        .orderBy(desc(launchDeployments.blockNumber)).limit(21) : [];
      const matches: LaunchMatch[] = [];
      const [project] = watch.projectHandle ? await tx.select().from(researchProjects).where(eq(researchProjects.handle, watch.projectHandle)).for("share") : [];
      const claims = project ? await tx.select().from(identityClaims).where(eq(identityClaims.projectHandle, project.handle)) : [];
      const declarations = candidates.filter(c => c.tokenDeclaration);
      const mappingConflict = report.gaps.some(g => /conflict|requires_review|multiple_/.test(g)) || watch.discovery?.gaps &&
        (watch.discovery.gaps as string[]).some(g => /conflict|requires_review|multiple_/.test(g));
      for (const d of deployments.slice(0, 20)) {
        const match: LaunchMatch = { tokenAddress: d.tokenAddress, deployerAddress: d.deployerAddress, creationTxHash: d.creationTxHash,
          factory: d.factory, blockNumber: d.blockNumber, basis: tokens.some(c => c.address === d.tokenAddress) ? "token" : "deployer", claimId: null };
        const declaration = declarations.find(c => c.address === d.tokenAddress);
        // A deployer may launch multiple tokens. Only an exact, uniquely declared CA can produce an untrusted draft.
        if (project?.enabled && project.domain === report.domain && declaration && !mappingConflict
          && new Set(declarations.map(c => c.address)).size === 1
          && deployments.filter(v => v.tokenAddress === d.tokenAddress).length === 1) {
          let sourceUrl: string; try { sourceUrl = identitySourceUrl(declaration.sourceUrl, project.domain); } catch { continue; }
          const prior = claims.find(c => c.domain === project.domain && c.tokenAddress === d.tokenAddress
            && c.deployerAddress === d.deployerAddress && c.creationTxHash === d.creationTxHash && c.sourceUrl === sourceUrl);
          // Never recreate an owner-revoked draft automatically.
          if (prior) match.claimId = prior.revokedAt ? null : prior.id;
          else if (claims.filter(c => !c.revokedAt).length < 5) {
            const [claim] = await tx.insert(identityClaims).values({ projectHandle: project.handle, domain: project.domain,
              sourceUrl, tokenAddress: d.tokenAddress, deployerAddress: d.deployerAddress, creationTxHash: d.creationTxHash }).returning();
            claims.push(claim); match.claimId = claim.id;
            await tx.insert(auditLog).values({ action: "identity_claim_drafted", actor: "launch_research", detail: { claimId: claim.id, watchId: watch.id } });
          }
        }
        matches.push(match);
      }
      if (JSON.stringify(matches) !== JSON.stringify(report.matches)) await tx.update(watchTargets).set({ launchReport: { ...report, matches } }).where(eq(watchTargets.id, watch.id));
    }
  });
}
export async function runLaunchPreparationLoop() {
  if (process.env.PROJECT_RESEARCH_ENABLED !== "true" || !process.env.DATABASE_URL) return;
  const db = createDb(process.env.DATABASE_URL);
  for (;;) {
    await waitForCollection(false);
    try { await reconcileLaunchWatches(db); } catch { console.warn("[launch] reconciliation deferred"); }
    await new Promise(resolve => setTimeout(resolve, 60_000));
  }
}
