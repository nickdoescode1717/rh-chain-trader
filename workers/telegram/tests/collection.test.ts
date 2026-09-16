import {test} from "node:test";
import assert from "node:assert/strict";
import {handleCollectionInput} from "../src/collection.js";
test("stop/status use existing authenticated owner channel and report data controls",async()=>{
 const calls:unknown[]=[];const state={paused:true,chainEnabled:false,rpcBlockedUntil:null,rpcRequestsToday:10,rpcDailyRequestLimit:2000,methods:[]};
 const api={getCollection:async()=>state,setCollection:async(...args:unknown[])=>{calls.push(args);return state;}};
 assert.match((await handleCollectionInput(api,"/stop","telegram:42"))!.text,/STOPPED/);
 assert.deepEqual(calls,[["stop","telegram:42"]]);
 await handleCollectionInput(api,"/status","telegram:42");assert.equal(calls.length,1);
 assert.equal(await handleCollectionInput(api,"/watch @project","telegram:42"),null);
});
