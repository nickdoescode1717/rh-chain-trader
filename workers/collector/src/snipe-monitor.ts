import { and, eq, sql } from "drizzle-orm";
import { createDb, collectionState, paperSnipes, type Db } from "@rh/db";
import { PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED } from "@rh/core";
import { collectionPermit, waitForCollection } from "./collection-control.js";
import { ponsDeployment, recordLaunchDeployment } from "./launch-preparation.js";
import type { RpcClient } from "./rpc.js";

/** Ten-second targeted polling, only during the first ten minutes of an explicitly armed paper plan. */
export async function pollSnipeLaunch(db: Db, rpc: RpcClient) {
  await collectionPermit();
  const control = await collectionState(db);
  if (control.paused || !control.chainEnabled || control.rpcRequestsToday >= control.rpcDailyRequestLimit
    || control.rpcBlockedUntil && Date.parse(String(control.rpcBlockedUntil)) > Date.now()) return;
  const plan = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9015)`);
    const [p] = await tx.select().from(paperSnipes).where(and(eq(paperSnipes.status,"armed"),
      sql`${paperSnipes.armedAt} > now() - interval '10 minutes' and ${paperSnipes.expiresAt} > now()`,
      sql`(${paperSnipes.monitorAttemptAt} is null or ${paperSnipes.monitorAttemptAt} < now() - interval '10 seconds')`))
      .orderBy(sql`${paperSnipes.monitorAttemptAt} asc nulls first`).limit(1);
    if (!p) return null;
    const [saved] = await tx.update(paperSnipes).set({monitorAttemptAt:new Date()}).where(eq(paperSnipes.id,p.id)).returning(); return saved;
  });
  if (!plan) return;
  if (plan.terms.mode !== "paper" || plan.terms.chainId !== 4663 || await rpc.getChainId() !== 4663) return;
  const head = await rpc.getBlockNumber(); if (head == null) return;
  const fromBlock = Math.max(0, (plan.monitorBlock ?? head) - 32), toBlock = Math.min(head, fromBlock + 1999);
  const topic = "0x" + "0".repeat(24) + plan.terms.deployerAddress.slice(2);
  const logs = await rpc.getLogs({fromBlock,toBlock,address:PONS_V2_LAUNCH_FACTORY,topics:[PONS_V2_TOKEN_LAUNCHED,null,null,topic]});
  for (const log of logs) {
    const d = ponsDeployment(log,4663);
    if (d && d.deployerAddress === plan.terms.deployerAddress && d.blockNumber >= fromBlock && d.blockNumber <= toBlock) await recordLaunchDeployment(db,log,4663);
  }
  await db.update(paperSnipes).set({monitorBlock:toBlock}).where(and(eq(paperSnipes.id,plan.id),eq(paperSnipes.status,"armed"),eq(paperSnipes.monitorAttemptAt,plan.monitorAttemptAt!)));
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
