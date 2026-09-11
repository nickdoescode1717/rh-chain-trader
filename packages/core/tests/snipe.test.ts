import assert from "node:assert/strict";
import {test} from "node:test";
import {snipeTerms} from "../src/snipe.js";
const input = {mode:"paper",chainId:4663,projectHandle:"project",deployerAddress:"0x"+"a".repeat(40),spendEth:"0.010",maxUnitPriceEth:"0.00001"};
test("snipe terms require explicit paper/mainnet scope, exact limits and a non-factory deployer",()=>{
  assert.equal(snipeTerms(input,"project.org").spendEth,"0.01");
  for(const change of [{mode:"live"},{chainId:46630},{tokenAddress:"0x"+"b".repeat(40)},{spendEth:"0"},{spendEth:0.1},
    {maxUnitPriceEth:"NaN"},{hours:0},{hours:25},{deployerAddress:"0x4e59b44847b379578588920cA78FbF26c0B4956C"}])
    assert.throws(()=>snipeTerms({...input,...change},"project.org"));
});
