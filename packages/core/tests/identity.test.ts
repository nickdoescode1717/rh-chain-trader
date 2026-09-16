import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateIdentity, identitySourceUrl, parseIdentityDeclaration, type IdentityReport } from "../src/identity.js";
const token="0x"+"a".repeat(40), other="0x"+"b".repeat(40);
const now=new Date(), source="https://project.org/token";
const report:IdentityReport={version:1,source:{status:"matched",url:source,hash:"abc",excerpt:"",addresses:[token],xLinked:false,reason:"match"},chain:{status:"matched",reason:"match",blockHash:"0x"+"c".repeat(64)}};
const claim=()=>({id:"claim",domain:"project.org",tokenAddress:token,sourceUrl:source,creationTxHash:"0x"+"d".repeat(64),reviewedAt:now,revokedAt:null,reviewedSourceHash:"abc",checkedAt:now,report:structuredClone(report)});
test("identity requires explicit reviewed source, fresh matching chain evidence and exact namespace",()=>{
  const input={projectHandle:"project",domain:"project.org",enabled:true,tokenAddress:token,claims:[claim()]};
  assert.equal(evaluateIdentity(input).status,"verified");
  assert.equal(evaluateIdentity({...input,tokenAddress:other}).status,"conflicting");
  assert.equal(evaluateIdentity({...input,domain:"copycat.org"}).status,"conflicting");
  assert.equal(evaluateIdentity({...input,projectHandle:null}).status,"unverified");
  assert.equal(evaluateIdentity({...input,enabled:false}).status,"unverified");
  for(const c of [{...claim(),reviewedAt:null},{...claim(),revokedAt:now},{...claim(),checkedAt:new Date(Date.now()-301000)},
    {...claim(),checkedAt:new Date(Date.now()+10000)},{...claim(),reviewedSourceHash:"changed"},{...claim(),report:null}])
    assert.equal(evaluateIdentity({...input,claims:[c]}).status,"unverified");
  const bad=claim();bad.report.chain.status="conflicting";
  assert.equal(evaluateIdentity({...input,claims:[bad]}).status,"conflicting");
  assert.equal(evaluateIdentity({...input,claims:[claim(),{...claim(),tokenAddress:other}]}).status,"conflicting");
  assert.equal(evaluateIdentity({...input,claims:[claim(),{...claim(),tokenAddress:other,reviewedAt:null}]}).status,"verified");
});
test("a mention, follower link, ticker, ambiguous disclaimer or different chain cannot become an official declaration",()=>{
  assert.equal(parseIdentityDeclaration(`Robinhood Chain. Token address: ${token}`,token).status,"matched");
  assert.equal(parseIdentityDeclaration(JSON.stringify({chainId:4663,tokenAddress:token}),token).status,"matched");
  for(const text of [`$GREAT ${token} score 100`,`Robinhood Chain ${token}`,`Token address: ${token}`,`Token address: ${other}. Chain ID: 1`,
    `Robinhood Chain token address: ${token} Token address: ${other}`,`Robinhood Chain. Not our token address: ${token}`,`Robinhood Chain. Factory contract address: ${token}`])
    assert.notEqual(parseIdentityDeclaration(text,token).status,"matched");
  for(const url of ["http://project.org/a","https://project.org.evil.com/a","https://project.org@evil.com/a","https://127.0.0.1/a","https://project.org:8443/a","https://project.org/a#fragment"])
    assert.throws(()=>identitySourceUrl(url,"project.org"));
  assert.equal(identitySourceUrl("https://docs.project.org/token","project.org"),"https://docs.project.org/token");
});
