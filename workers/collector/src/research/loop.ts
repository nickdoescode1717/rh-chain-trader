import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { createDb, researchProjects, socialSignals, socialAccounts } from "@rh/db";
import { inspectProject } from "./inspect.js";
import { enrichWithGrok } from "./grok.js";
export async function runProjectResearchLoop(): Promise<void> {
  if (process.env.PROJECT_RESEARCH_ENABLED !== "true" || !process.env.DATABASE_URL) {
    console.log("[project-research] disabled; requires explicit opt-in and PostgreSQL"); return;
  }
  const db = createDb(process.env.DATABASE_URL);
  for (;;) {
    try {
      // One project at a time; at most hourly per project, including failed attempts.
      const [project] = await db.select().from(researchProjects).where(and(eq(researchProjects.enabled, true),
        sql`(${researchProjects.lastResearchedAt} IS NULL OR ${researchProjects.lastResearchedAt} < now() - interval '1 hour')`))
        .orderBy(sql`${researchProjects.lastResearchedAt} ASC NULLS FIRST`, asc(researchProjects.createdAt)).limit(1);
      if (project) {
        // Claim before external requests so concurrent workers don't duplicate paid enrichment.
        const [claimed] = await db.update(researchProjects).set({ lastResearchedAt: new Date(), lastError: "scan_in_progress" })
          .where(and(eq(researchProjects.id, project.id), project.lastResearchedAt === null
            ? isNull(researchProjects.lastResearchedAt) : eq(researchProjects.lastResearchedAt, project.lastResearchedAt))).returning();
        if (claimed) {
          try {
            const report = await inspectProject(project);
            const recent = await db.select({ signal: socialSignals }).from(socialSignals)
              .innerJoin(socialAccounts, eq(socialSignals.accountId, socialAccounts.id))
              .where(eq(socialAccounts.handle, project.handle)).orderBy(sql`${socialSignals.observedAt} DESC`).limit(20);
            for (const { signal } of recent) report.evidence.push({ id: `social-${signal.id}`, url: signal.sourceUrl,
              observedAt: signal.observedAt.toISOString(), kind: signal.kind, finding: signal.text.slice(0, 5000) });
            const grok = await enrichWithGrok(report);
            await db.update(researchProjects).set({ report: { ...report, grok }, lastError: null })
              .where(and(eq(researchProjects.id, project.id), eq(researchProjects.domain, project.domain),
                eq(researchProjects.lastResearchedAt, claimed.lastResearchedAt!)));
          } catch {
            await db.update(researchProjects).set({ lastError: "project_research_failed" }).where(and(
              eq(researchProjects.id, project.id), eq(researchProjects.lastResearchedAt, claimed.lastResearchedAt!)));
          }
        }
      }
    } catch { console.warn("[project-research] storage unavailable; check migration 0007"); }
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}
