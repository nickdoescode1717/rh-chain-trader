import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const postgres=createRequire(import.meta.resolve('@rh/db'))('postgres');
import {createDb,changeCollection} from '@rh/db';
import {launchCandidates,PONS_V2_LAUNCH_FACTORY,PONS_V2_TOKEN_LAUNCHED} from '@rh/core';
import {recordLaunchDeployment,reconcileLaunchWatches} from '../dist/launch-preparation.js';
import {installCollectionControl} from '../dist/collection-control.js';
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/rh_pricing_test_[a-f0-9]{16}$/);
const sql=postgres(process.env.DATABASE_URL),db=createDb(process.env.DATABASE_URL);
if(process.argv[2]==='restart') {await reconcileLaunchWatches(db);process.exit(0);}
globalThis.fetch=async()=>{throw new Error('Network forbidden in launch fixture');};
installCollectionControl(db);
await changeCollection(db,'run','telegram:42');
await sql`update watch_targets set enabled=false`;
await sql`insert into research_projects(handle,domain) values('launchfixture','launchfixture.org')`;
const token='0x'+'a'.repeat(40),deployer='0x'+'b'.repeat(40),other='0x'+'c'.repeat(40);
const topic=a=>'0x'+'0'.repeat(24)+a.slice(2);
const event=(address,hash='d')=>({address:PONS_V2_LAUNCH_FACTORY,topics:[PONS_V2_TOKEN_LAUNCHED,topic(address),topic(other),topic(deployer)],
  blockNumber:'0x123',blockHash:'0x'+'e'.repeat(64),transactionHash:'0x'+hash.repeat(64),data:'0x',logIndex:'0x0'});
await Promise.all([recordLaunchDeployment(db,event(token),4663),recordLaunchDeployment(db,event(token),4663)]);
assert.equal((await sql`select * from launch_deployments where token_address=${token}`).length,1);
const document=text=>({url:'https://launchfixture.org/token',text,observedAt:new Date().toISOString(),kind:'website'});
const report=text=>({version:1,domain:'launchfixture.org',observedAt:new Date().toISOString(),candidates:launchCandidates([document(text)],'launchfixture.org'),gaps:[],pagesChecked:[],matches:[]});
const [watch]=await sql`insert into watch_targets(input_key,handle,project_handle,launch_flag,launch_report) values
  ('x:launchfixture','launchfixture','launchfixture',true,${sql.json(report('Deployer: '+deployer))}) returning *`;
const saved=async()=>(await sql`select * from watch_targets where id=${watch.id}`)[0];
const claims=async()=>await sql`select * from identity_claims where project_handle='launchfixture'`;
await reconcileLaunchWatches(db);assert.equal((await saved()).launch_report.matches[0].tokenAddress,token);assert.equal((await claims()).length,0);
// Multiple launches from a candidate deployer remain distinct and never imply issuer ownership.
await recordLaunchDeployment(db,event(other,'f'),4663);await reconcileLaunchWatches(db);
assert.equal((await saved()).launch_report.matches.length,2);assert.equal((await claims()).length,0);
const exact=report(`Robinhood Chain. Token address: ${token}. Deployer: ${deployer}`);
// Mapping conflicts and per-watch pause prevent automatic drafts.
await sql`update watch_targets set launch_report=${sql.json({...exact,gaps:['profile_domain_conflict']})} where id=${watch.id}`;
await reconcileLaunchWatches(db);assert.equal((await claims()).length,0);
await sql`update watch_targets set enabled=false,launch_report=${sql.json(exact)} where id=${watch.id}`;
await reconcileLaunchWatches(db);assert.equal((await claims()).length,0);
await sql`update watch_targets set enabled=true where id=${watch.id}`;
await changeCollection(db,'stop','telegram:42');
await assert.rejects(()=>reconcileLaunchWatches(db));assert.equal((await claims()).length,0);
await changeCollection(db,'run','telegram:42');
// Existing reports can match while RPC is OFF; no network calls or trust granted.
await Promise.all([reconcileLaunchWatches(db),reconcileLaunchWatches(db)]);
const [claim]=await claims();assert.ok(claim);assert.equal((await claims()).length,1);
assert.equal(claim.token_address,token);assert.equal(claim.deployer_address,deployer);
assert.equal(claim.reviewed_at,null);assert.equal(claim.reviewed_by,null);assert.equal(claim.report,null);
const restarted=spawnSync(process.execPath,['tests/launch.integration.mjs','restart'],{encoding:'utf8'});
assert.equal(restarted.status,0,restarted.stdout+restarted.stderr);assert.equal((await claims()).length,1);
await sql`update identity_claims set revoked_at=now() where id=${claim.id}`;
await reconcileLaunchWatches(db);assert.equal((await claims()).length,1);
assert.ok((await saved()).launch_report.matches.every(m=>m.claimId===null));
const stale=structuredClone(exact);stale.candidates.forEach(c=>c.observedAt=new Date(Date.now()-86_400_001).toISOString());
await sql`update watch_targets set launch_report=${sql.json(stale)} where id=${watch.id}`;
await reconcileLaunchWatches(db);assert.equal((await saved()).launch_report.matches.length,0);
assert.equal((await sql`select coalesce(sum(attempts),0)::int as count from rpc_usage`)[0].count,0);
console.log('Launch integration passed: exact event matching, deployer-only leads, competing tokens, conflicts, pause, concurrency/restart idempotency, revoked drafts, stale evidence, zero RPC.');
await sql.end();process.exit(0);
