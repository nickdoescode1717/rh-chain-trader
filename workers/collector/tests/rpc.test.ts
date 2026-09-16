import assert from "node:assert/strict";
import {test} from "node:test";
import {createRpcClient} from "../src/rpc.js";

test("malformed log responses cannot masquerade as an empty block range",async()=>{
  const original=globalThis.fetch;
  let result:unknown={unexpected:"response"};
  globalThis.fetch=async()=>new Response(JSON.stringify({jsonrpc:"2.0",id:1,result}));
  try {
    const rpc=createRpcClient("https://fixture.invalid/rpc");
    const filter={fromBlock:1,toBlock:2};
    await assert.rejects(()=>rpc.getLogs(filter),/invalid_get_logs_response/);
    result=null;await assert.rejects(()=>rpc.getLogs(filter),/invalid_get_logs_response/);
    result=[];assert.deepEqual(await rpc.getLogs(filter),[]);
  } finally {globalThis.fetch=original;}
});
