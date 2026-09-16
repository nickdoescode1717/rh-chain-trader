import assert from "node:assert/strict";
import {test} from "node:test";
import {snipeTerms} from "../src/snipe.js";
const input = {mode:"paper",chainId:4663,projectHandle:"project",deployerAddress:"0x"+"a".repeat(40),spendEth:"0.010",maxUnitPriceEth:"0.00001"};
test("snipe terms require explicit paper/mainnet scope, exact limits and a non-factory deployer",()=>{
  const terms=snipeTerms(input,"project.org");assert.equal(terms.spendEth,"0.01");assert.equal(terms.version,2);
  assert.equal(terms.gasAllowanceEth,"0.0001");assert.equal(terms.maxRoundTripLossBps,1000);
  for(const change of [{mode:"live"},{chainId:46630},{tokenAddress:"0x"+"b".repeat(40)},{spendEth:"0"},{spendEth:0.1},
    {maxUnitPriceEth:"NaN"},{gasAllowanceEth:"0"},{gasAllowanceEth:0.1},{hours:0},{hours:721},{hours:1.5},{deployerAddress:"0x4e59b44847b379578588920cA78FbF26c0B4956C"}])
    assert.throws(()=>snipeTerms({...input,...change},"project.org"));
  assert.equal(snipeTerms({...input,gasAllowanceEth:"0.00025"},"project.org").gasAllowanceEth,"0.00025");
});
test("unknown launch dates allow explicit week/month plans while keeping a bounded default",()=>{
  assert.equal(snipeTerms(input,"project.org").hours,24);
  for(const hours of [168,720]) assert.equal(snipeTerms({...input,hours},"project.org").hours,hours);
});
