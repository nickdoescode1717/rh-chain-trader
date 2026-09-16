import assert from "node:assert/strict";
import {test} from "node:test";
import {formatSnipe,handleSnipeInput,createSnipeAlerts} from "../src/snipes.js";
import type {SnipePlan} from "../src/api.js";
const fixture=():SnipePlan=>({id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",status:"draft",reason:"review_required",createdAt:new Date().toISOString(),armedAt:null,expiresAt:null,tokenAddress:null,fillId:null,
  terms:{version:2,gasAllowanceEth:"0.0001",maxRoundTripLossBps:1000,projectHandle:"project",domain:"project.org",deployerAddress:"0x"+"a".repeat(40),spendEth:"0.01",maxUnitPriceEth:"0.001",hours:24,mode:"paper",chainId:4663}});
test("paper snipe command drafts only, then explicit callback arms with owner actor",async()=>{
 const p=fixture(),calls:unknown[]=[];
 const api={listSnipes:async()=>[p],draftSnipe:async(body:unknown)=>{calls.push(body);return p;},decideSnipe:async(...args:unknown[])=>{calls.push(args);return p;}};
 await handleSnipeInput(api,`/snipe @project 0.01 0.001 ${p.terms.deployerAddress}`,"telegram:42");
 assert.equal(calls.length,1);assert.equal((calls[0] as any).mode,"paper");assert.equal((calls[0] as any).chainId,4663);
 await handleSnipeInput(api,`snipe:arm:${p.id}`,"telegram:42");assert.deepEqual(calls[1],[p.id,"arm","telegram:42"]);
 const card=formatSnipe(p);assert.match(card.text,/ONE automatic paper buy/);assert.match(card.text,/~5 minutes until expiry/);
 assert.match(card.text,/fixed gas allowance: 0.0001 ETH/);assert.match(card.text,/passing native-ETH Pons V2 simulation required/);
 assert.match(card.text,/Maximum immediate round-trip loss: 10%/);assert.match(card.text,/DEX indexing is not required/);
 assert.ok(card.text.length<4096);assert.ok(card.reply_markup!.inline_keyboard.flat().every(b=>Buffer.byteLength(b.callback_data)<=64));
});
test("snipe guide explains values and unknown launch timing without creating a plan",async()=>{
 const api={listSnipes:async()=>[],draftSnipe:async()=>{throw new Error('unexpected draft');},decideSnipe:async()=>{throw new Error('unexpected arm');}};
 for (const input of ['/snipe','/snipe @project','snipe:help:project']) {
   const card=(await handleSnipeInput(api,input,'telegram:42'))!;
   assert.match(card.text,/total paper ETH/);assert.match(card.text,/ONE token in ETH/);
   assert.match(card.text,/no expiry while enabled/);assert.match(card.text,/720 = 30 days/);
   assert.match(card.text,/DEPLOYER_WALLET/);assert.ok(card.text.length<4096);
 }
 const bad=(await handleSnipeInput(api,'/snipe @project 0.01 0.000001 DEPLOYER_WALLET 168','telegram:42'))!;
 assert.match(bad.text,/Replace DEPLOYER_WALLET/);
 const list=(await handleSnipeInput(api,'/snipes','telegram:42'))!;assert.match(list.text,/No saved plans/);
});
test("arming failures and waiting states tell the owner the next action",async()=>{
 const p=fixture();p.reason='one_reviewed_mainnet_identity_required';
 assert.match(formatSnipe(p).text,/Open Identity review/);
 const api={listSnipes:async()=>[p],draftSnipe:async()=>p,decideSnipe:async()=>{throw new Error('enable_chain_collection_before_arming');}};
 const card=(await handleSnipeInput(api,`snipe:arm:${p.id}`,'telegram:42'))!;
 assert.match(card.text,/Send \/chainon/);assert.match(card.text,/tap Arm paper plan/);
 let body:any;
 await handleSnipeInput({...api,draftSnipe:async(b:Record<string,unknown>)=>{body=b;return p;}},`/snipe @project 0.01 0.000001 ${p.terms.deployerAddress} 720`,'telegram:42');
 assert.equal(body.hours,720);assert.equal(body.maxUnitPriceEth,'0.000001');
});
test("snipe alerts survive restart and ignore unchanged statuses",async()=>{
 const p=fixture();p.status="armed";let state={},sent=0;
 const api={listSnipes:async()=>[p]},store={load:()=>state,save:(s:{})=>{state=s;}};
 const send=async()=>{sent++;};await createSnipeAlerts(api,store,send)();await createSnipeAlerts(api,store,send)();assert.equal(sent,1);
 p.status="filled";p.fillId="fill";await createSnipeAlerts(api,store,send)();assert.equal(sent,2);
});
test("route button requests simulation only and draft route results notify once",async()=>{
 const p=fixture(),calls:unknown[]=[];
 const api={listSnipes:async()=>[p],draftSnipe:async()=>p,decideSnipe:async(...args:unknown[])=>{calls.push(args);return p;}};
 await handleSnipeInput(api,`snipe:route:${p.id}`,'telegram:42');assert.deepEqual(calls,[[p.id,'route','telegram:42']]);
 p.routeReport={status:'passed',reason:'round_trip_simulated',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()-1).toISOString(),quantity:'100',spendEth:'0.01',buyFeeEth:'0.0001',creatorTaxEth:'0.0002',sellReturnEth:'0.0094',roundTripLossEth:'0.0006',buyGasEstimateEth:'0.000003',executionGasEstimateEth:'0.00001',blockNumber:100};
 const card=formatSnipe(p);assert.match(card.text,/historical result/);assert.match(card.text,/trigger ONE paper fill/);assert.match(card.text,/buy execution gas: 0.000003 ETH/);assert.match(card.text,/round-trip execution gas/);assert.ok(card.text.length<4096);
 assert.ok(card.reply_markup!.inline_keyboard.flat().some(b=>b.text==='Test buy + sell'));
 let state={},sent=0;const store={load:()=>state,save:(s:{})=>{state=s;}};
 await createSnipeAlerts(api,store,async()=>{sent++;})();await createSnipeAlerts(api,store,async()=>{sent++;})();assert.equal(sent,1);
});
test("legacy approved plans retain the original fixed-fee policy",()=>{
 const p=fixture();p.terms.version=1;p.terms.minLiquidityUsd=1000;delete p.terms.gasAllowanceEth;delete p.terms.maxRoundTripLossBps;
 const card=formatSnipe(p);assert.match(card.text,/Legacy policy v1/);assert.doesNotMatch(card.text,/Both amounts are reserved/);
});
