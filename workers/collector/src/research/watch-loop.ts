import { and, eq, sql } from "drizzle-orm";
import { createDb, watchTargets, researchProjects, socialAccounts } from "@rh/db";
import { discoverWatch } from "./watch-discovery.js";
import { createWatchSocialReader } from "./twitterapi.js";
import { inspectProject } from "./inspect.js";
import { enrichWithGrok } from "./grok.js";
import { budgetedXReader } from "./budgeted-x.js";

export async function runWatchLoop(): Promise<void> {
  if (process.env.PROJECT_RESEARCH_ENABLED !== "true" || !process.env.DATABASE_URL) return;
  const db = createDb(process.env.DATABASE_URL);
  const social = process.env.WATCH_X_ENABLED === "true" && process.env.TWITTERAPI_IO_KEY
    ? budgetedXReader(db, createWatchSocialReader(process.env.TWITTERAPI_IO_KEY)) : null;
  for (;;) {
    try { await scanNextWatch(db, social); }
    catch { console.warn("[watch] collection unavailable; retrying on schedule"); }
    await new Promise(resolve => setTimeout(resolve, 60_000));
  }
}

/** Claim once per hour (including failures), and discard results if paused during collection. */
export async function scanNextWatch(db: ReturnType<typeof createDb>, social: Parameters<typeof discoverWatch>[2],
  discover = discoverWatch, inspect = inspectProject, enrich = enrichWithGrok) {
  const claimed = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663, 9011)`);
    const [row] = await tx.select().from(watchTargets).where(and(eq(watchTargets.enabled, true),
      sql`(${watchTargets.lastAttemptAt} is null or ${watchTargets.lastAttemptAt} < now() - interval '1 hour')`))
      .orderBy(sql`${watchTargets.lastAttemptAt} asc nulls first`, watchTargets.createdAt).limit(1);
    if (!row) return null;
    const [saved] = await tx.update(watchTargets).set({ lastAttemptAt: new Date(), lastError: "scan_in_progress" })
      .where(eq(watchTargets.id, row.id)).returning();
    return saved;
  });
  if (!claimed) return;
  try {
    let known = null;
    if (claimed.projectHandle) [known] = await db.select().from(researchProjects).where(eq(researchProjects.handle, claimed.projectHandle));
    const { discovery, posts } = await discover({ handle: claimed.handle ?? known?.handle ?? null, domain: claimed.domain ?? known?.domain ?? null }, undefined, social);
    let report = null;
    if (discovery.domain) {
      report = await inspect({ handle: discovery.primaryHandle, domain: discovery.domain, category: known?.category ?? "unknown" });
      for (const [i, post] of posts.entries()) report.evidence.push({ id: `watch-post-${i}`, url: post.url, kind: "recent_post",
        finding: `${post.publishedAt ?? "publication time unknown"}: ${post.text}`, observedAt: post.observedAt ?? discovery.observedAt });
      for (const [i, account] of discovery.accounts.entries()) report.evidence.push({ id: `watch-account-${i}`, url: account.sourceUrl,
        kind: "related_account", finding: `@${account.handle}: ${account.relation}. ${account.description ?? "Profile not collected"}`, observedAt: account.observedAt ?? discovery.observedAt });
    }
    const enriched = report ? { ...report, grok: await enrich(report) } : null;
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(4663, 9011)`);
      const [current] = await tx.select().from(watchTargets).where(eq(watchTargets.id, claimed.id));
      if (!current?.enabled || current.revision !== claimed.revision || current.lastAttemptAt?.getTime() !== claimed.lastAttemptAt?.getTime()) return;
      let projectHandle = current.projectHandle;
      if (discovery.primaryHandle && discovery.domain && !discovery.gaps.includes("profile_domain_conflict")) {
        // Never overwrite or resume an existing mapping based on web content.
        const [existing] = await tx.select().from(researchProjects).where(eq(researchProjects.handle, discovery.primaryHandle));
        if (existing && (existing.domain !== discovery.domain || !existing.enabled)) discovery.gaps.push("existing_project_mapping_requires_review");
        else {
          if (!existing) await tx.insert(researchProjects).values({ handle: discovery.primaryHandle, domain: discovery.domain });
          projectHandle = discovery.primaryHandle;
          await tx.insert(socialAccounts).values({ handle: projectHandle, label: "Auto-discovered research candidate; identity unverified" }).onConflictDoNothing();
          if (enriched) await tx.update(researchProjects).set({ report: enriched, lastResearchedAt: claimed.lastAttemptAt, lastError: null })
            .where(and(eq(researchProjects.handle, projectHandle), eq(researchProjects.domain, discovery.domain), eq(researchProjects.enabled, true)));
        }
      }
      await tx.update(watchTargets).set({ discovery: discovery as unknown as Record<string, unknown>, report: enriched, projectHandle,
        status: discovery.domain ? "watching" : "waiting_for_website", lastError: null }).where(eq(watchTargets.id, claimed.id));
    });
  } catch {
    await db.update(watchTargets).set({ lastError: "watch_research_failed" }).where(and(eq(watchTargets.id, claimed.id),
      eq(watchTargets.revision, claimed.revision), eq(watchTargets.enabled, true)));
  }
}
