import assert from "node:assert/strict";
import {test} from "node:test";
import {createRouteRpc} from "../src/route-rpc.js";
test("route transport refuses signing/broadcast and caps paid calls",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_input,init)=>{calls++;const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({id:body.id,result:"0x1237"}));};
  try {
    const rpc=createRouteRpc("https://fixture.invalid/rpc");
    await assert.rejects(()=>rpc("eth_sendRawTransaction",[]));await assert.rejects(()=>rpc("eth_sign",[]));assert.equal(calls,0);
    for(let i=0;i<20;i++)assert.equal(await rpc("eth_chainId",[]),"0x1237");
    await assert.rejects(()=>rpc("eth_chainId",[]));assert.equal(calls,20);
  } finally {globalThis.fetch=original;}
});
