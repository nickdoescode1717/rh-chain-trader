import {and,eq,isNull,sql} from "drizzle-orm";
import {createDb,collectionState,paperSnipes,identityClaims,researchProjects,type Db} from "@rh/db";
import {evaluateIdentity,type RouteReport,type IdentityReport} from "@rh/core";
import {inspectPonsRoute,SIMULATION_WALLET,type RouteRpc} from "./pons-route.js";
import {createRouteRpc} from "./route-rpc.js";
import {waitForCollection} from "./collection-control.js";
export async function pollRouteChecks(db:Db,rpcFactory:()=>RouteRpc=createRouteRpc) {
  const control=await collectionState(db);
  if(control.paused||!control.chainEnabled||control.rpcRequestsToday>control.rpcDailyRequestLimit-20||control.rpcBlockedUntil&&Date.parse(String(control.rpcBlockedUntil))>Date.now())return;
  const plan=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9016)`);
    const [p]=await tx.select().from(paperSnipes).where(and(sql`${paperSnipes.status} in ('draft','armed')`,
      sql`${paperSnipes.routeRequestedAt} is not null and (${paperSnipes.routeCheckedAt} is null or ${paperSnipes.routeRequestedAt}>${paperSnipes.routeCheckedAt})`,
      sql`${paperSnipes.routeAttemptAt} is null or ${paperSnipes.routeAttemptAt}<now()-interval '30 seconds'`)).orderBy(paperSnipes.routeRequestedAt).limit(1);
    if(!p)return null;
    const [saved]=await tx.update(paperSnipes).set({routeAttemptAt:new Date(Date.now()+240_000)}).where(eq(paperSnipes.id,p.id)).returning();return saved;
  });
  if(!plan)return;
  const input={tokenAddress:plan.tokenAddress??"",deployerAddress:plan.terms.deployerAddress,budgetEth:plan.terms.spendEth,maxUnitPriceEth:plan.terms.maxUnitPriceEth};
  const blocked=(reason:string):RouteReport=>({version:1,venue:"pons-v2-native-curve",status:"blocked",reason,observedAt:new Date().toISOString(),chainId:4663,...input,simulationWallet:SIMULATION_WALLET,limitations:["No trade authorized or submitted."]});
  const identityCurrent=async()=>{
    const [project]=await db.select().from(researchProjects).where(eq(researchProjects.handle,plan.terms.projectHandle));
    const claims=await db.select().from(identityClaims).where(and(eq(identityClaims.projectHandle,plan.terms.projectHandle),isNull(identityClaims.revokedAt)));
    const reviewed=claims.filter(c=>c.reviewedAt);
    return project?.enabled&&project.domain===plan.terms.domain&&reviewed.length===1&&reviewed[0].tokenAddress===input.tokenAddress&&reviewed[0].deployerAddress===input.deployerAddress
      &&evaluateIdentity({projectHandle:project.handle,tokenAddress:input.tokenAddress,domain:project.domain,enabled:project.enabled,claims:claims.map(c=>({...c,report:c.report as IdentityReport|null}))}).status==="verified";
  };
  let report:RouteReport;
  if(Date.now()-plan.routeRequestedAt!.getTime()>300_000)report=blocked("route_request_expired");
  else if(!await identityCurrent())report=blocked("identity_changed_or_stale");
  else report=await inspectPonsRoute(input,rpcFactory());
  const after=await collectionState(db);
  if(after.paused||!after.chainEnabled)report=blocked("collection_disabled");
  else if(!await identityCurrent())report=blocked("identity_changed_or_stale");
  await db.update(paperSnipes).set({routeReport:report,routeCheckedAt:new Date()}).where(and(eq(paperSnipes.id,plan.id),eq(paperSnipes.routeRequestedAt,plan.routeRequestedAt!),eq(paperSnipes.routeAttemptAt,plan.routeAttemptAt!),sql`${paperSnipes.status} in ('draft','armed')`));
}
export async function runRouteChecks() {
  if(process.env.PAPER_SNIPER_ENABLED!=="true"||!process.env.DATABASE_URL)return;
  const db=createDb(process.env.DATABASE_URL);
  for(;;){await waitForCollection(true);try{await pollRouteChecks(db);}catch{console.warn("[paper-route] check deferred");}await new Promise(r=>setTimeout(r,10_000));}
}
