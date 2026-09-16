import assert from "node:assert/strict";
import { test } from "node:test";
import { routePaperBuy, routeBinding } from "../src/route-paper.js";
import { snipeTerms, snipeReservation } from "../src/snipe.js";
import type { RouteReport } from "../src/route.js";
const now=Date.now(),token="0x"+"a".repeat(40),deployer="0x"+"b".repeat(40);
const terms=snipeTerms({mode:"paper",chainId:4663,projectHandle:"fixture",deployerAddress:deployer,spendEth:"0.01",maxUnitPriceEth:"0.0001"},"fixture.org");
const context={token,binding:"bound",requestedAt:new Date(now-2000),armedAt:new Date(now-30_000),born:Math.floor(now/1000)-20,deploymentBlock:"50"};
const report:RouteReport={version:1,venue:"pons-v2-native-curve",status:"passed",reason:"round_trip_simulated",observedAt:new Date(now-1000).toISOString(),chainId:4663,
  tokenAddress:token,deployerAddress:deployer,budgetEth:"0.01",maxUnitPriceEth:"0.0001",simulationWallet:"0x"+"1".repeat(40),
  binding:"bound",requestedAt:context.requestedAt.toISOString(),blockNumber:100,blockHash:"0x"+"c".repeat(64),blockTimestamp:Math.floor(now/1000),expiresAt:new Date(now+50_000).toISOString(),
  quantity:"100",spendEth:"0.01",buyFeeEth:"0.0001",creatorTaxEth:"0.0002",buyGasEstimateEth:"0.00001",sellReturnEth:"0.0094",roundTripLossEth:"0.0006",limitations:[]};
test("new policy reserves full gas allowance and uses exact route outputs without double charging fees",()=>{
  assert.equal(terms.version,2);assert.equal(snipeReservation(terms),10100000000000000n);
  const fill=routePaperBuy(terms,report,context,now);
  assert.equal(fill.quantity,"100");assert.equal(fill.fee,"0.0003");assert.equal(fill.cost,"0.0101");assert.equal(fill.cashDelta,"-0.0101");
  assert.equal(fill.executionPrice,"0.0001");assert.equal(fill.gasAllowance,"0.0001");assert.equal(fill.model.gasAccounting,"full_approved_allowance");
});
test("route settlement rejects stale, unbound, mismatched and over-limit reports",()=>{
  for(const patch of [{status:"failed"},{chainId:46630},{tokenAddress:deployer},{deployerAddress:token},{binding:"changed"},{requestedAt:undefined},
    {spendEth:"0.009"},{budgetEth:"0.02"},{maxUnitPriceEth:"1"},{quantity:"99"},{quantity:"0"},{quantity:"NaN"},{buyGasEstimateEth:undefined},
    {buyGasEstimateEth:"0.000100000000000001"},{creatorTaxEth:"0.01"},{sellReturnEth:"0"},{roundTripLossEth:"0.0005"},{sellReturnEth:"0.008",roundTripLossEth:"0.002"},
    {observedAt:new Date(now+1).toISOString()},{expiresAt:new Date(now-1).toISOString()},{expiresAt:new Date(now+120_000).toISOString()},
    {blockHash:"bad"},{blockTimestamp:context.born-1},{blockNumber:49},{version:2}]){
    assert.throws(()=>routePaperBuy(terms,{...report,...patch} as RouteReport,context,now),JSON.stringify(patch));
  }
  assert.throws(()=>routePaperBuy(terms,report,{...context,armedAt:new Date(now)},now));
  assert.throws(()=>snipeTerms({mode:"paper",chainId:4663,projectHandle:"fixture",deployerAddress:deployer,spendEth:"0.01",maxUnitPriceEth:"0.0001",gasAllowanceEth:"0"},"fixture.org"));
});
test("binding changes with the reviewed source, deployment block or immutable limits",()=>{
  const claim={id:"claim",sourceUrl:"https://fixture.org/token",reviewedSourceHash:"source",reviewedAt:new Date(now),creationTxHash:"tx",report:{chain:{blockHash:"one"}}};
  const original=routeBinding("plan",terms,claim);
  for(const changed of [{...claim,reviewedSourceHash:"other"},{...claim,sourceUrl:"https://fixture.org/other"},{...claim,report:{chain:{blockHash:"two"}}}])assert.notEqual(routeBinding("plan",terms,changed),original);
  assert.notEqual(routeBinding("plan",{...terms,spendEth:"0.02"},claim),original);
});
