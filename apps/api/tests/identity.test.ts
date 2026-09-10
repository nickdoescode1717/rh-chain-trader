import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { identityRoutes } from "../src/routes/identity.js";
test("source trust endpoints reject Grok, missing credentials and malformed IDs; draft cannot supply verification",async()=>{
  const keys=["TELEGRAM_APPROVAL_TOKEN","TELEGRAM_OWNER_USER_ID","TELEGRAM_CHAT_ID"];
  const original=keys.map(k=>process.env[k]);
  process.env.TELEGRAM_APPROVAL_TOKEN="x".repeat(64);process.env.TELEGRAM_OWNER_USER_ID="42";process.env.TELEGRAM_CHAT_ID="42";
  const app=new Hono();app.route("/identity",identityRoutes);
  const post=(path:string,body:unknown,secret="x".repeat(64))=>app.request(path,{method:"POST",headers:{"content-type":"application/json","x-telegram-approval-token":secret},body:JSON.stringify(body)});
  try {
    for(const action of ["review","confirm","revoke"]){
      assert.equal((await post(`/identity/11111111-1111-4111-8111-111111111111/${action}`,{actor:"grok"})).status,403);
      assert.equal((await post(`/identity/11111111-1111-4111-8111-111111111111/${action}`,{actor:"telegram:42"},"wrong")).status,403);
      assert.equal((await post(`/identity/bad/${action}`,{actor:"telegram:42"})).status,400);
    }
    assert.equal((await post('/identity/claims',{projectHandle:"test",verified:true})).status,400);
    assert.equal((await app.request('/identity/claims/not-a-uuid')).status,400);
  } finally {keys.forEach((k,i)=>{if(original[i]===undefined)delete process.env[k];else process.env[k]=original[i];});}
});
