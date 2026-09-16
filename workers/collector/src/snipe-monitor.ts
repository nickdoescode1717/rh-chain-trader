import { and, eq, sql } from "drizzle-orm";
import { createDb, collectionState, paperSnipes, type Db } from "@rh/db";
import { PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED } from "@rh/core";
import { collectionPermit, waitForCollection } from "./collection-control.js";
import { ponsDeployment, recordLaunchDeployment } from "./launch-preparation.js";
import type { RpcClient } from "./rpc.js";

/** Batch due deployers: fast initially, then every five minutes until the approved expiry. */
export async function pollSnipeLaunch(db: Db, rpc: RpcClient) {
  await collectionPermit();
  const control = await collectionState(db);
  if (control.paused || !control.chainEnabled || control.rpcRequestsToday >= control.rpcDailyRequestLimit
    || control.rpcBlockedUntil && Date.parse(String(control.rpcBlockedUntil)) > Date.now()) return;
  const plans = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9015)`);
    const due = await tx.select().from(paperSnipes).where(and(eq(paperSnipes.status,"armed"),
      sql`${paperSnipes.expiresAt} > now()`,
      sql`(${paperSnipes.monitorAttemptAt} is null or ${paperSnipes.monitorAttemptAt} < now() -
        case when ${paperSnipes.armedAt} > now() - interval '10 minutes' then interval '10 seconds' else interval '5 minutes' end)`))
      .orderBy(sql`${paperSnipes.monitorAttemptAt} asc nulls first`).limit(5);
    const claimed = [];
    for (const p of due) {
      // Lease exceeds the bounded RPC timeouts so overlapping workers cannot re-claim in flight.
      const [saved] = await tx.update(paperSnipes).set({monitorAttemptAt:new Date(Date.now()+120_000)}).where(eq(paperSnipes.id,p.id)).returning();
      claimed.push(saved);
    }
    return claimed;
  });
  let behind = false;
  try {
    const eligible = plans.filter(p => p.terms.mode === "paper" && p.terms.chainId === 4663);
    if (!eligible.length || await rpc.getChainId() !== 4663) return;
    const head = await rpc.getBlockNumber(); if (head == null) return;
    if (!Number.isSafeInteger(head) || head < 0) throw new Error("invalid_block_number");
    // A bounded initial lookback covers recent deployment while startup/reconnect was delayed.
    // Existing cursors are never jumped to the head: catch-up retains every unprocessed range.
    const fromBlock = Math.max(0, Math.min(...eligible.map(p => p.monitorBlock == null ? head - 19999 : p.monitorBlock - 32)));
    let toBlock = Math.min(head, fromBlock + 19999);
    if (fromBlock > toBlock) throw new Error("head_behind_monitor_cursor");
    const deployers = new Set(eligible.map(p => p.terms.deployerAddress));
    const topics = [...deployers].map(a => "0x" + "0".repeat(24) + a.slice(2));
    const filter = {address:PONS_V2_LAUNCH_FACTORY,topics:[PONS_V2_TOKEN_LAUNCHED,null,null,topics]};
    let logs;
    try { logs = await rpc.getLogs({fromBlock,toBlock,...filter}); }
    catch (e) {
      // One bounded range fallback, never unlimited splitting/retries that exhaust the provider.
      if (toBlock-fromBlock < 2000 || !(e instanceof Error) || !/block range|too many (results|logs)|response size|range is too large|query returned more than/i.test(e.message)) throw e;
      toBlock = Math.min(toBlock,fromBlock+1999);
      logs = await rpc.getLogs({fromBlock,toBlock,...filter});
    }
    for (const log of logs) {
      const d = ponsDeployment(log,4663);
      if (d && deployers.has(d.deployerAddress) && d.blockNumber >= fromBlock && d.blockNumber <= toBlock) await recordLaunchDeployment(db,log,4663);
    }
    for (const plan of eligible) {
      await db.update(paperSnipes).set({
        monitorBlock:Math.max(plan.monitorBlock ?? 0,toBlock),
      }).where(and(eq(paperSnipes.id,plan.id),eq(paperSnipes.status,"armed"),eq(paperSnipes.monitorAttemptAt,plan.monitorAttemptAt!)));
    }
    behind = toBlock < head;
  } finally {
    for (const plan of plans) {
      // Failed reads leave cursors untouched. A successful partial range catches up next tick.
      await db.update(paperSnipes).set({monitorAttemptAt:new Date(Date.now()-(behind ? 300_001 : 0))})
        .where(and(eq(paperSnipes.id,plan.id),eq(paperSnipes.status,"armed"),eq(paperSnipes.monitorAttemptAt,plan.monitorAttemptAt!)));
    }
  }
}
export async function runSnipeMonitor(rpc: RpcClient) {
  if (process.env.PAPER_SNIPER_ENABLED !== "true" || !process.env.DATABASE_URL) return;
  const db = createDb(process.env.DATABASE_URL);
  for (;;) {
    await waitForCollection(true);
    try { await pollSnipeLaunch(db,rpc); } catch { console.warn("[paper-snipe] targeted monitor deferred within RPC limits"); }
    await new Promise(resolve=>setTimeout(resolve,10_000));
  }
}
