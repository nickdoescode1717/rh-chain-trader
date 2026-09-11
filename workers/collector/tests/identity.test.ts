import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectIdentityChain, inspectIdentity } from "../src/identity.js";
import { PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED } from "@rh/core";
const token="0x"+"a".repeat(40), deployer="0x"+"b".repeat(40), txHash="0x"+"c".repeat(64), blockHash="0x"+"d".repeat(64), headHash="0x"+"e".repeat(64);
const claim={domain:"project.org",projectHandle:"project",sourceUrl:"https://project.org/token",tokenAddress:token,deployerAddress:deployer,creationTxHash:txHash};
const fixture=()=>({chainId:"0x1237", receipt:{transactionHash:txHash,blockHash,blockNumber:"0x64",status:"0x1",contractAddress:token,logs:[] as any[]},
  tx:{hash:txHash,blockHash,blockNumber:"0x64",from:deployer,to:null as string|null},canonical:{hash:blockHash,number:"0x64"},head:{hash:headHash,number:"0x80"},prior:"0x",code:"0x60006000"});
function reader(f:ReturnType<typeof fixture>) {return async(method:string,params:unknown[])=>{
  if(method==="eth_chainId")return f.chainId;
  if(method==="eth_getTransactionReceipt")return f.receipt;
  if(method==="eth_getTransactionByHash")return f.tx;
  if(method==="eth_getBlockByNumber")return params[0]==="0x64"?f.canonical:f.head;
  if(method==="eth_getCode")return params[1]==="0x63"?f.prior:f.code;
  throw Error("unexpected method");
};}
test("direct deployment requires exact token/creator, canonical successful receipt, enough blocks and creation code",async()=>{
  assert.equal((await inspectIdentityChain(claim,reader(fixture()))).status,"matched");
  const mutations=[(f:ReturnType<typeof fixture>)=>f.chainId="0x1",f=>f.receipt.contractAddress=deployer,f=>f.tx.from=token,
    f=>f.receipt.status="0x0",f=>f.canonical.hash=headHash,f=>f.head.number="0x65",f=>f.prior="0x60",f=>f.code="0x",f=>f.tx.blockHash=headHash];
  for(const mutate of mutations){const f=fixture();mutate(f);assert.notEqual((await inspectIdentityChain(claim,reader(f))).status,"matched");}
});
test("factory proof is emitter/ABI/token/deployer bound and cannot use arbitrary events or existing code",async()=>{
  const f=fixture();f.receipt.contractAddress=null as any;f.tx.to=PONS_V2_LAUNCH_FACTORY;
  const word=(a:string)=>"0x"+"0".repeat(24)+a.slice(2);
  f.receipt.logs=[{address:PONS_V2_LAUNCH_FACTORY,transactionHash:txHash,blockHash,topics:[PONS_V2_TOKEN_LAUNCHED,word(token),word(deployer),word(deployer)]}];
  assert.equal((await inspectIdentityChain(claim,reader(f))).status,"matched");
  f.tx.to=deployer;assert.equal((await inspectIdentityChain(claim,reader(f))).status,"matched"); // routed launch still has authenticated factory emitter
  f.receipt.logs[0].topics[3]=word(token);assert.equal((await inspectIdentityChain(claim,reader(f))).status,"conflicting");
  f.receipt.logs[0].address=deployer;assert.notEqual((await inspectIdentityChain(claim,reader(f))).status,"matched");
  f.tx.to=deployer;assert.equal((await inspectIdentityChain(claim,reader(f))).reason,"unsupported_factory_creation_path");
});
test("source evidence comes from fetched pinned URL, records content hash, and fails closed on provider errors",async()=>{
  const read=async(url:string)=>({url,status:200,contentType:"text/html",text:`<p>Robinhood Chain. Token address: ${token}</p><a href="https://x.com/project">X</a>`});
  const r=await inspectIdentity(claim,read,reader(fixture()));
  assert.equal(r.source.status,"matched");assert.equal(r.source.xLinked,true);assert.equal(r.source.hash?.length,64);
  const changed=await inspectIdentity(claim,async url=>({...await read(url),text:`Robinhood Chain token address: ${deployer}`}),reader(fixture()));
  assert.equal(changed.source.status,"conflicting");
  const unavailable=await inspectIdentity(claim,async()=>{throw Error("secret url");},async()=>{throw Error("secret rpc");});
  assert.equal(unavailable.source.status,"unavailable");assert.equal(unavailable.chain.status,"unavailable");assert.ok(!JSON.stringify(unavailable).includes("secret"));
  const redirect=await inspectIdentity(claim,async url=>({...await read(url),url:"https://project.org/redirect"}),reader(fixture()));
  assert.equal(redirect.source.status,"unavailable");
});
