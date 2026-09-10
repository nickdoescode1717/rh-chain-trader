import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

// USD 0.50 at 100,000 credits/USD. No public API/LLM can raise this ceiling.
export const X_DAILY_CREDITS = 50_000;
export const X_RESERVED_CREDITS = { profile: 18, posts: 300 } as const;
export async function xUsage(db: Db) {
  const [row] = await db.execute(sql`select
    coalesce(sum(reserved_credits) filter (where created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')),0)::int as today,
    coalesce(sum(reserved_credits),0)::int as rolling,
    count(*)::int as requests,
    (select blocked_until from x_provider_state where id=1) as blocked_until,
    (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC' as resets_at
    from x_request_budget where created_at > now() - interval '24 hours'`);
  return { dailyLimitUsd: 0.50, reservedTodayUsd: Number(row.today) / 100_000,
    reserved24hUsd: Number(row.rolling) / 100_000, remainingUsd: Math.max(0, X_DAILY_CREDITS - Number(row.rolling)) / 100_000,
    requests24h: Number(row.requests), blockedUntil: row.blocked_until, resetsAt: row.resets_at,
    accounting: "conservative_reservations_not_provider_invoice" };
}

/** Reserve BEFORE I/O; failures/crashes retain their full allowance. Shared across all watches/processes. */
export async function reserveXRequest(db: Db, kind: "profile" | "posts", handle: string, maxAgeMs: number) {
  if (!/^[a-z0-9_]{1,15}$/.test(handle) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) throw new Error("invalid_x_request");
  const key = `${kind}:${handle}`;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9012)`);
    const [clock] = await tx.execute(sql`select clock_timestamp() as time`);
    const now = new Date(clock.time as string);
    const [cache] = await tx.execute(sql`select * from x_response_cache where cache_key=${key}`);
    if (cache?.payload && cache.observed_at && now.getTime() >= new Date(cache.observed_at as string).getTime() && now.getTime() - new Date(cache.observed_at as string).getTime() < maxAgeMs)
      return { cached: cache.payload, id: null };
    if (cache?.next_attempt_at && new Date(cache.next_attempt_at as string) > now) throw new Error("x_refresh_deferred");
    const [state] = await tx.execute(sql`select blocked_until from x_provider_state where id=1`);
    if (!state) throw new Error("x_budget_unavailable");
    if (state.blocked_until && new Date(state.blocked_until as string) > now) throw new Error("x_provider_backoff");
    const [spend] = await tx.execute(sql`select coalesce(sum(reserved_credits),0)::int as credits from x_request_budget where created_at > ${now}::timestamptz - interval '24 hours'`);
    const cost = X_RESERVED_CREDITS[kind];
    if (Number(spend.credits) + cost > X_DAILY_CREDITS) throw new Error("x_daily_budget_exhausted");
    const [request] = await tx.execute(sql`insert into x_request_budget(cache_key,reserved_credits,created_at) values(${key},${cost},${now}) returning id`);
    await tx.execute(sql`insert into x_response_cache(cache_key,lease_id,next_attempt_at) values(${key},${request.id},${new Date(now.getTime()+600_000)})
      on conflict(cache_key) do update set lease_id=excluded.lease_id,next_attempt_at=excluded.next_attempt_at`);
    return { cached: null, id: String(request.id) };
  });
}
export async function finishXRequest(db: Db, id: string, payload: unknown, blocked = false) {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9012)`);
    if (payload !== null) await tx.execute(sql`update x_response_cache set payload=${JSON.stringify(payload)}::jsonb,observed_at=now(),next_attempt_at=null,lease_id=null where lease_id=${id}::uuid`);
    else await tx.execute(sql`update x_response_cache set next_attempt_at=now()+interval '1 hour',lease_id=null where lease_id=${id}::uuid`);
    await tx.execute(sql`update x_request_budget set state=${payload === null ? "failed" : "success"} where id=${id}::uuid and state='reserved'`);
    if (blocked) await tx.execute(sql`update x_provider_state set blocked_until=greatest(coalesce(blocked_until,now()),now()+interval '1 hour') where id=1`);
  });
}
