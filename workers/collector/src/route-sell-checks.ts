import {and,eq,sql} from "drizzle-orm";
import {collectionState,createDb,paperSellIntents,positions,type Db} from "@rh/db";
import {decimal,routePaperSell,units,type RouteSellReport} from "@rh/core";
import {inspectPonsSellRoute,SIMULATION_WALLET,type RouteRpc} from "./pons-route.js";
import {createRouteRpc} from "./route-rpc.js";
import {waitForCollection} from "./collection-control.js";

type RouteEntry={model?:{version?:string};route?:{deployerAddress?:string}};
export async function pollRouteSellChecks(db:Db,rpcFactory:()=>RouteRpc=createRouteRpc){
  const control=await collectionState(db);
  if(control.paused||!control.chainEnabled||control.rpcRequestsToday>control.rpcDailyRequestLimit-20||control.rpcBlockedUntil&&Date.parse(String(control.rpcBlockedUntil))>Date.now())return;
  const job=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(4663,9017)`);
    const [row]=await tx.select({intent:paperSellIntents,position:positions}).from(paperSellIntents).innerJoin(positions,eq(positions.id,paperSellIntents.positionId))
      .where(and(sql`${paperSellIntents.status} in ('route_quoting','route_confirming')`,sql`${paperSellIntents.routeRequestedAt} is not null`,
        sql`${paperSellIntents.routeAttemptAt} is null or ${paperSellIntents.routeAttemptAt}<now()-interval '30 seconds'`))
      .orderBy(paperSellIntents.routeRequestedAt).limit(1);
    if(!row)return null;
    const [leased]=await tx.update(paperSellIntents).set({routeAttemptAt:new Date(Date.now()+240_000)})
      .where(and(eq(paperSellIntents.id,row.intent.id),eq(paperSellIntents.status,row.intent.status))).returning();
    return leased?{intent:leased,position:row.position}:null;
  });
  if(!job)return;
  const {intent,position}=job,requested=intent.routeRequestedAt!;
  const tokenAddress=position.tokenAddress?.toLowerCase()??"";
  const entry=(position.entrySnapshot as {execution?:RouteEntry}|null)?.execution;
  const deployer=entry?.route?.deployerAddress?.toLowerCase()??"";
  const quantity=position.remainingQuantity?decimal(units(position.remainingQuantity)*BigInt(intent.percent)/100n):"0";
  const blocked=(reason:string):RouteSellReport=>({version:1,venue:"pons-v2-native-curve",status:"blocked",reason,observedAt:new Date().toISOString(),
    requestedAt:requested.toISOString(),chainId:4663,tokenAddress,deployerAddress:deployer,quantity,
    simulationWallet:SIMULATION_WALLET,limitations:["No trade authorized or submitted."]});
  let report:RouteSellReport;
  if(Date.now()-requested.getTime()>300_000)report=blocked("route_sell_request_expired");
  else if(entry?.model?.version!=="pons-route-paper-v1"||!/^0x[0-9a-f]{40}$/.test(deployer)||!/^0x[0-9a-f]{40}$/.test(tokenAddress)||!position.remainingQuantity||!position.remainingCost||position.positionVersion!==intent.positionVersion)report=blocked("route_sell_position_changed");
  else {report=await inspectPonsSellRoute({tokenAddress,deployerAddress:deployer,quantity},rpcFactory());report.requestedAt=requested.toISOString();}
  const after=await collectionState(db);if(after.paused||!after.chainEnabled)report=blocked("collection_disabled");
  let status="route_failed",preview=intent.preview,minimumNet=intent.minimumNet,expiresAt=new Date(Date.now()+60_000);
  if(report.status==="passed")try{
    const execution=routePaperSell(position.remainingQuantity!,position.remainingCost!,intent.percent,report,{token:tokenAddress,deployer,requestedAt:requested});
    preview=execution;minimumNet=decimal(units(execution.cashDelta)*9900n/10000n);
    status=intent.status==="route_confirming"?"execution_ready":"pending";
    expiresAt=new Date(report.expiresAt!);
  }catch{report=blocked("route_sell_report_invalid");}
  await db.update(paperSellIntents).set({routeReport:report,routeCheckedAt:new Date(),preview,minimumNet,status,expiresAt})
    .where(and(eq(paperSellIntents.id,intent.id),eq(paperSellIntents.routeAttemptAt,intent.routeAttemptAt!),eq(paperSellIntents.status,intent.status)));
}

export async function runRouteSellChecks(){
  if(process.env.PAPER_SNIPER_ENABLED!=="true"||!process.env.DATABASE_URL)return;
  const db=createDb(process.env.DATABASE_URL);
  for(;;){await waitForCollection(true);try{await pollRouteSellChecks(db);}catch{console.warn("[paper-route-sell] check deferred");}await new Promise(r=>setTimeout(r,10_000));}
}
