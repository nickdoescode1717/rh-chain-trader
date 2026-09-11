import assert from "node:assert/strict";
import { test } from "node:test";
import { formatIdentityReview, handleIdentityInput } from "../src/identity.js";
import { formatProposal } from "../src/format.js";
import type { ApiClient, IdentityClaim } from "../src/api.js";
const id="11111111-1111-4111-8111-111111111111";
const claim:IdentityClaim={id,projectHandle:"project",domain:"project.org",sourceUrl:"https://project.org/token",tokenAddress:"0x"+"a".repeat(40),deployerAddress:"0x"+"b".repeat(40),creationTxHash:"0x"+"c".repeat(64),reviewedAt:null,revokedAt:null,checkedAt:new Date().toISOString(),report:null};
test("Telegram separates source-review preview from owner confirmation and preserves full identity",async()=>{
  let confirms=0;
  const review={claim,review:{id,expiresAt:new Date().toISOString()}};
  const api={reviewIdentity:async()=>review,confirmIdentity:async()=>{confirms++;return {confirmed:true};}} as unknown as ApiClient;
  const card=await handleIdentityInput(api,`identity:review:${id}`,"telegram:42");
  assert.equal(confirms,0);assert.ok(card!.text.includes(claim.tokenAddress));assert.ok(card!.text.includes(claim.creationTxHash));
  assert.match(card!.text,/NOT A TRADE/);assert.ok(card!.text.length<4096);
  for(const b of formatIdentityReview(review).reply_markup!.inline_keyboard.flat())assert.ok(Buffer.byteLength(b.callback_data)<=64);
  await handleIdentityInput(api,`identity:confirm:${id}`,"telegram:42");assert.equal(confirms,1);
});
test("high scores and stale proposal buttons do not offer approval when identity is blocked",()=>{
  for(const status of ["unverified","conflicting"]){
    const p=formatProposal({id,projectHandle:"project",tokenCA:claim.tokenAddress,identityGateEnabled:true,issuerIdentity:{status,reasons:["source_review_required"]},scores:{opportunity:100,risk:0,evidenceConfidence:1,identityVerified:true}});
    assert.ok(!p.reply_markup!.inline_keyboard.flat().some(b=>b.callback_data.startsWith("approve:")));
    assert.match(p.text,/Paper buy blocked/);
    assert.ok(p.reply_markup!.inline_keyboard.flat().some(b=>b.callback_data==="identity:list:project"));
  }
  const verified=formatProposal({id,identityGateEnabled:true,issuerIdentity:{status:"verified"}});
  assert.ok(verified.reply_markup!.inline_keyboard.flat().some(b=>b.callback_data.startsWith("approve:")));
});
