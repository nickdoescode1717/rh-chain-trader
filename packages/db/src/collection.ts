import { sql } from "drizzle-orm";
import type { Db } from "./client.js";
export const RPC_DAILY_REQUEST_LIMIT = 2000;
export async function collectionState(db: Db) {
  const [row] = await db.execute(sql`select paused,chain_enabled,rpc_blocked_until,updated_at from collection_control where id=1`);
  if (!row) throw new Error("collection_control_unavailable");
  const methods = await db.execute(sql`select method,attempts from rpc_usage where day=to_char(now() at time zone 'UTC','YYYY-MM-DD') order by attempts desc`);
  return { paused: Boolean(row.paused), chainEnabled: Boolean(row.chain_enabled), rpcBlockedUntil: row.rpc_blocked_until,
    rpcRequestsToday: methods.reduce((n,r)=>n+Number(r.attempts),0), rpcDailyRequestLimit: RPC_DAILY_REQUEST_LIMIT, methods: [...methods], updatedAt: row.updated_at };
}
export async function changeCollection(db: Db, action: "stop" | "run" | "chainon" | "chainoff", actor: string) {
  await db.transaction(async tx => {
    // Same ordering as paper settlement: book before collection, so /stop cannot race an automatic fill.
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9009)`);
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9013)`);
    if (action === "stop") await tx.execute(sql`update collection_control set paused=true,chain_enabled=false,changed_by=${actor},updated_at=now() where id=1`);
    if (action === "run") await tx.execute(sql`update collection_control set paused=false,chain_enabled=false,changed_by=${actor},updated_at=now() where id=1`);
    if (action === "chainon") await tx.execute(sql`update collection_control set paused=false,chain_enabled=true,changed_by=${actor},updated_at=now() where id=1`);
    if (action === "chainoff") await tx.execute(sql`update collection_control set chain_enabled=false,changed_by=${actor},updated_at=now() where id=1`);
    if (action === "stop" || action === "chainoff" || action === "run") await tx.execute(sql`update paper_snipes set status='cancelled',reason='collection_disabled' where status='armed'`);
  });
  return collectionState(db);
}
export async function permitCollection(db: Db, rpcMethod?: string) {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9013)`);
    const [s] = await tx.execute(sql`select *,rpc_blocked_until > now() as cooldown from collection_control where id=1`);
    if (!s || s.paused) throw new Error("collection_stopped");
    if (!rpcMethod) return;
    if (!s.chain_enabled || s.cooldown) throw new Error("chain_collection_paused");
    const [usage] = await tx.execute(sql`select coalesce(sum(attempts),0)::int as used from rpc_usage where day=to_char(now() at time zone 'UTC','YYYY-MM-DD')`);
    if (Number(usage.used) >= RPC_DAILY_REQUEST_LIMIT) throw new Error("rpc_daily_limit_reached");
    const method = /^eth_[a-zA-Z0-9]{1,45}$/.test(rpcMethod) ? rpcMethod : "unknown";
    await tx.execute(sql`insert into rpc_usage(day,method,attempts) values(to_char(now() at time zone 'UTC','YYYY-MM-DD'),${method},1)
      on conflict(day,method) do update set attempts=rpc_usage.attempts+1`);
  });
}
export async function pauseRpcProvider(db: Db) {
  await db.execute(sql`update collection_control set rpc_blocked_until=now()+interval '1 hour' where id=1`);
}
