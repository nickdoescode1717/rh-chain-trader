import { and, eq, asc, sql } from "drizzle-orm";
import { createDb, socialAccounts, socialSignals } from "@rh/db";
import { createXReader, XReadError } from "./x-client.js";
import { scanAccount, type ScanState } from "./scanner.js";

function setting(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`invalid_${name}`);
  return value;
}

export async function runSocialLoop(): Promise<void> {
  // Explicit opt-in so installing the code cannot start billable API usage.
  if (process.env.X_DISCOVERY_ENABLED !== "true") {
    console.log("[social] disabled; set X_DISCOVERY_ENABLED=true after configuring API access and accounts");
    return;
  }
  if (!process.env.X_BEARER_TOKEN || !process.env.DATABASE_URL) {
    console.warn("[social] blocked: X_BEARER_TOKEN and DATABASE_URL required");
    return;
  }
  const pollMs = setting("X_POLL_MS", 300_000, 60_000, 86_400_000);
  const accountsPerTick = setting("X_ACCOUNTS_PER_TICK", 1, 1, 20);
  const graphIntervalMs = setting("X_GRAPH_INTERVAL_MS", 3_600_000, 300_000, 604_800_000);
  const maxGraphUsers = setting("X_MAX_GRAPH_USERS", 10_000, 100, 100_000);
  const db = createDb(process.env.DATABASE_URL);
  const reader = createXReader(process.env.X_BEARER_TOKEN);
  let retryAt = 0;
  console.log("[social] X read-only discovery enabled; no signing or order submission");
  for (;;) {
    try {
      if (Date.now() >= retryAt) {
        const accounts = await db.select().from(socialAccounts)
          .where(and(eq(socialAccounts.enabled, true),
            sql`(${socialAccounts.lastPolledAt} IS NULL OR ${socialAccounts.lastPolledAt} < now() - ${pollMs} * interval '1 millisecond')`))
          .orderBy(sql`${socialAccounts.lastPolledAt} ASC NULLS FIRST`, asc(socialAccounts.createdAt))
          .limit(accountsPerTick);
        for (const account of accounts) {
          try {
            const result = await scanAccount({ ...account, state: account.state as ScanState }, reader, Date.now(), graphIntervalMs, maxGraphUsers);
            await db.transaction(async (tx) => {
              // Optimistic concurrency prevents a second collector committing an older cursor.
              const updated = await tx.update(socialAccounts).set({
                xUserId: result.xUserId, state: result.state as Record<string, unknown>,
                lastPolledAt: new Date(), lastError: null,
              }).where(and(eq(socialAccounts.id, account.id),
                sql`${socialAccounts.lastPolledAt} IS NOT DISTINCT FROM ${account.lastPolledAt}`)).returning({ id: socialAccounts.id });
              if (!updated.length) return;
              if (result.signals.length) await tx.insert(socialSignals)
                .values(result.signals.map((signal) => ({ ...signal, accountId: account.id })))
                .onConflictDoNothing({ target: socialSignals.sourceKey });
            });
          } catch (error) {
            // Only controlled codes are persisted. Never log response text or secret-bearing URLs.
            const code = error instanceof XReadError ? error.code : "social_scan_failed";
            await db.update(socialAccounts).set({ lastPolledAt: new Date(), lastError: code })
              .where(eq(socialAccounts.id, account.id));
            console.warn(`[social] ${account.handle}: ${code}`);
            if (error instanceof XReadError && error.retryAt) { retryAt = error.retryAt; break; }
            // Avoid repeated billable/unauthorized requests across accounts when credentials fail.
            if (["x_http_401", "x_http_402", "x_http_403"].includes(code)) { retryAt = Date.now() + 3_600_000; break; }
          }
        }
      }
    } catch { console.warn("[social] storage unavailable; check database and migration 0006"); }
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, 60_000)));
  }
}
