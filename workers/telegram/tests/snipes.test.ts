import assert from "node:assert/strict";
import {test} from "node:test";
import {formatSnipe,handleSnipeInput,createSnipeAlerts} from "../src/snipes.js";
import type {SnipePlan} from "../src/api.js";
const fixture=():SnipePlan=>({id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",status:"draft",reason:"review_required",createdAt:new Date().toISOString(),armedAt:null,expiresAt:null,tokenAddress:null,fillId:null,
  terms:{projectHandle:"project",domain:"project.org",deployerAddress:"0x"+"a".repeat(40),spendEth:"0.01",maxUnitPriceEth:"0.001",minLiquidityUsd:1000,hours:24,mode:"paper",chainId:4663}});
test("paper snipe command drafts only, then explicit callback arms with owner actor",async()=>{
 const p=fixture(),calls:unknown[]=[];
 const api={listSnipes:async()=>[p],draftSnipe:async(body:unknown)=>{calls.push(body);return p;},decideSnipe:async(...args:unknown[])=>{calls.push(args);return p;}};
 await handleSnipeInput(api,`/snipe @project 0.01 0.001 ${p.terms.deployerAddress}`,"telegram:42");
 assert.equal(calls.length,1);assert.equal((calls[0] as any).mode,"paper");assert.equal((calls[0] as any).chainId,4663);
 await handleSnipeInput(api,`snipe:arm:${p.id}`,"telegram:42");assert.deepEqual(calls[1],[p.id,"arm","telegram:42"]);
 const card=formatSnipe(p);assert.match(card.text,/ONE automatic paper buy/);assert.match(card.text,/120 RPC/);
 assert.ok(card.text.length<4096);assert.ok(card.reply_markup!.inline_keyboard.flat().every(b=>Buffer.byteLength(b.callback_data)<=64));
});
test("snipe alerts survive restart and ignore unchanged statuses",async()=>{
 const p=fixture();p.status="armed";let state={},sent=0;
 const api={listSnipes:async()=>[p]},store={load:()=>state,save:(s:{})=>{state=s;}};
 const send=async()=>{sent++;};await createSnipeAlerts(api,store,send)();await createSnipeAlerts(api,store,send)();assert.equal(sent,1);
 p.status="filled";p.fillId="fill";await createSnipeAlerts(api,store,send)();assert.equal(sent,2);
});
