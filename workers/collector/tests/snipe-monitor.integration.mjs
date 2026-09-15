import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const postgres=createRequire(import.meta.resolve('@rh/db'))('postgres');
import {createDb,changeCollection} from '@rh/db';
import {snipeTerms,PONS_V2_LAUNCH_FACTORY,PONS_V2_TOKEN_LAUNCHED} from '@rh/core';
import {pollSnipeLaunch} from '../dist/snipe-monitor.js';
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/rh_pricing_test_[a-f0-9]{16}$/);
const sql=postgres(process.env.DATABASE_URL),db=createDb(process.env.DATABASE_URL);
await sql`insert into collection_control(id) values(1) on conflict do nothing`;
await changeCollection(db,'chainon','telegram:42');
const token='0x'+'1'.repeat(40),deployer='0x'+'2'.repeat(40),other='0x'+'3'.repeat(40),stranger='0x'+'6'.repeat(40),topic=a=>'0x'+'0'.repeat(24)+a.slice(2);
let calls=0,head=100,expected=[deployer],failure=null,lastFilter;
const log={address:PONS_V2_LAUNCH_FACTORY,topics:[PONS_V2_TOKEN_LAUNCHED,topic(token),topic(other),topic(deployer)],
  blockNumber:'0x64',blockHash:'0x'+'4'.repeat(64),transactionHash:'0x'+'5'.repeat(64),data:'0x',logIndex:'0x0'};
const rpc={getChainId:async()=>{calls++;return 4663;},getBlockNumber:async()=>{calls++;return head;},getLogs:async filter=>{
 calls++;lastFilter=filter;assert.equal(filter.address,PONS_V2_LAUNCH_FACTORY);
 assert.deepEqual([...filter.topics[3]].sort(),expected.map(topic).sort());
 assert.deepEqual(filter.topics.slice(0,3),[PONS_V2_TOKEN_LAUNCHED,null,null]);
 assert.ok(filter.toBlock-filter.fromBlock<20000);
 if(failure==='outage')throw new Error('fixture provider outage');
 if(failure==='range' && filter.toBlock-filter.fromBlock>=2000)throw new Error('block range too large');
 return [log,...(head===5000 ? [{...log,blockNumber:'0x1388',transactionHash:'0x'+'7'.repeat(64),topics:[PONS_V2_TOKEN_LAUNCHED,topic(other),topic(other),topic(deployer)]}] : []),
 {...log,topics:[PONS_V2_TOKEN_LAUNCHED,topic(other),topic(other),topic(stranger)]},{...log,removed:true}];}};
await pollSnipeLaunch(db,rpc);assert.equal(calls,0);
const terms=snipeTerms({projectHandle:'fixture',deployerAddress:deployer,spendEth:'0.1',maxUnitPriceEth:'0.001',hours:720,mode:'paper',chainId:4663},'fixture.org');
const [plan]=await sql`insert into paper_snipes(terms,created_by,status,armed_at,expires_at) values(${sql.json(terms)},'telegram:42','armed',now()-interval '1 second',now()+interval '30 days') returning id`;
await Promise.all([pollSnipeLaunch(db,rpc),pollSnipeLaunch(db,rpc)]);assert.equal(calls,3);
assert.equal((await sql`select * from launch_deployments`).length,1);
const cursor=async()=>Number((await sql`select monitor_block from paper_snipes where id=${plan.id}`)[0].monitor_block);
assert.equal(await cursor(),100);
await pollSnipeLaunch(createDb(process.env.DATABASE_URL),rpc);assert.equal(calls,3);
// Days-old plans continue, batching due deployers in one query.
await sql`update paper_snipes set monitor_attempt_at=null,armed_at=now()-interval '7 days' where id=${plan.id}`;
const [second]=await sql`insert into paper_snipes(terms,created_by,status,armed_at,expires_at) values(${sql.json({...terms,projectHandle:'other',deployerAddress:other})},'telegram:42','armed',now()-interval '2 days',now()+interval '1 day') returning id`;
expected=[deployer,other];await pollSnipeLaunch(db,rpc);assert.equal(calls,6);
await sql`update paper_snipes set monitor_attempt_at=now()-interval '4 minutes'`;
await pollSnipeLaunch(db,rpc);assert.equal(calls,6);
await sql`update paper_snipes set monitor_attempt_at=now()-interval '6 minutes'`;
head=5000;await pollSnipeLaunch(createDb(process.env.DATABASE_URL),rpc);assert.equal(calls,9);assert.equal(lastFilter.fromBlock,68);assert.equal(await cursor(),5000);
assert.equal((await sql`select * from launch_deployments where token_address=${other}`).length,1);
// A failed read cannot skip blocks or cause repeated immediate slow-watch calls.
await sql`update paper_snipes set monitor_attempt_at=null`;
failure='outage';await assert.rejects(()=>pollSnipeLaunch(db,rpc),/outage/);assert.equal(await cursor(),5000);
const afterFailure=calls;await pollSnipeLaunch(db,rpc);assert.equal(calls,afterFailure);
// At most one range fallback; partial reads keep their cursor and catch up next tick.
failure='range';head=40000;await sql`update paper_snipes set monitor_attempt_at=null`;
const beforeRange=calls;await pollSnipeLaunch(db,rpc);assert.equal(calls-beforeRange,4);
assert.equal(lastFilter.fromBlock,4968);assert.equal(await cursor(),6967);
failure=null;await pollSnipeLaunch(db,rpc);assert.equal(await cursor(),26934);
await pollSnipeLaunch(db,rpc);assert.equal(await cursor(),40000);
// Expired plans and a fresh plan's in-flight lease do not make RPC calls.
await sql`update paper_snipes set expires_at=now()-interval '1 second' where id=${second.id}`;
await sql`update paper_snipes set armed_at=now(),monitor_attempt_at=now()+interval '1 minute' where id=${plan.id}`;
const beforeStop=calls;await pollSnipeLaunch(db,rpc);assert.equal(calls,beforeStop);
await sql`update paper_snipes set monitor_attempt_at=null where id=${plan.id}`;
await sql`update collection_control set chain_enabled=false where id=1`;
await pollSnipeLaunch(db,rpc);assert.equal(calls,beforeStop);
await sql`update collection_control set chain_enabled=true where id=1`;
await sql`insert into rpc_usage(day,method,attempts) values(to_char(now() at time zone 'UTC','YYYY-MM-DD'),'eth_getLogs',2000)`;
await pollSnipeLaunch(db,rpc);assert.equal(calls,beforeStop);
await sql`delete from rpc_usage`;await changeCollection(db,'stop','telegram:42');await changeCollection(db,'chainon','telegram:42');
await pollSnipeLaunch(db,rpc);assert.equal(calls,beforeStop);
console.log('Targeted monitor integration passed: delayed launches, batching, persistent leases/cursors, bounded catch-up/range fallback, provider failures, expiry, stop and cap. Fake RPC only.');
await sql.end();process.exit(0);
