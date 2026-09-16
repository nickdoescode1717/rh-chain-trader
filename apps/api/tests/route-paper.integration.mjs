import assert from 'node:assert/strict';
import postgres from 'postgres';
import {spawnSync} from 'node:child_process';
import {createDb,changeCollection,identityClaims} from '@rh/db';
import {routeBinding} from '@rh/core';
import {initDb} from '../dist/db.js';
import {draftSnipe,decideSnipe,evaluateSnipe} from '../dist/snipes.js';
import {ledgerBook,previewSell,confirmSell} from '../dist/paper-ledger.js';
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/rh_pricing_test_[a-f0-9]{16}$/);
await initDb();
if(process.argv[2]==='restart'){await evaluateSnipe(process.argv[3]);process.exit(0);}
const sql=postgres(process.env.DATABASE_URL),db=createDb(process.env.DATABASE_URL),actor='telegram:42';
await sql`insert into collection_control(id) values(1) on conflict do nothing`;
await changeCollection(db,'chainon',actor);
await sql`insert into research_projects(handle,domain) values('routepaper','routepaper.org')`;
const token='0x'+'a'.repeat(40),deployer='0x'+'b'.repeat(40),hash='0x'+'c'.repeat(64);
const plan=await draftSnipe({projectHandle:'routepaper',deployerAddress:deployer,spendEth:'0.7',maxUnitPriceEth:'0.002',mode:'paper',chainId:4663},actor);
assert.equal(plan.terms.version,2);
await decideSnipe(plan.id,'arm',actor);
await sql`update paper_snipes set armed_at=now()-interval '30 seconds' where id=${plan.id}`;
assert.equal((await ledgerBook()).balance.reservedSnipeEth,'0.7001');
assert.equal((await ledgerBook()).balance.availableCashEth,'0.2999');
const identity={version:1,source:{status:'matched',hash:'reviewed',reason:'match'},chain:{status:'matched',reason:'match',blockNumber:'50',blockHash:hash,blockTimestamp:Math.floor(Date.now()/1000)-20}};
await sql`insert into identity_claims(project_handle,domain,source_url,token_address,deployer_address,creation_tx_hash,report,checked_at,reviewed_at,reviewed_by,reviewed_source_hash)
 values('routepaper','routepaper.org','https://routepaper.org/token',${token},${deployer},${hash},${sql.json(identity)},now(),now(),'telegram:42','reviewed')`;
assert.equal((await sql`select route_requested_at from paper_snipes where id=${plan.id}`)[0].route_requested_at,null);
await Promise.all([evaluateSnipe(plan.id),evaluateSnipe(plan.id)]);
const [queued]=await sql`select * from paper_snipes where id=${plan.id}`;
assert.ok(queued.route_requested_at);assert.equal(queued.reason,'waiting_for_route_simulation');
assert.equal((await sql`select count(*)::int n from audit_log where action='paper_route_auto_requested'`)[0].n,1);
await evaluateSnipe(plan.id);
assert.equal((await sql`select count(*)::int n from paper_fills`)[0].n,0);
const [claim]=await db.select().from(identityClaims);
const report={version:1,venue:'pons-v2-native-curve',status:'passed',reason:'round_trip_simulated',observedAt:new Date().toISOString(),chainId:4663,
 tokenAddress:token,deployerAddress:deployer,budgetEth:'0.7',maxUnitPriceEth:'0.002',simulationWallet:'0x'+'1'.repeat(40),
 binding:routeBinding(plan.id,plan.terms,claim),requestedAt:queued.route_requested_at.toISOString(),blockNumber:100,blockHash:hash,blockTimestamp:Math.floor(Date.now()/1000),expiresAt:new Date(Date.now()+50_000).toISOString(),
 quantity:'400',spendEth:'0.7',buyFeeEth:'0.007',creatorTaxEth:'0.014',buyGasEstimateEth:'0.00001',sellReturnEth:'0.658',roundTripLossEth:'0.042',limitations:[]};
const setReport=async(patch={})=>sql`update paper_snipes set route_report=${sql.json({...report,...patch})},route_checked_at=now() where id=${plan.id}`;
for(const [patch,reason] of [[{status:'blocked'},'waiting_for_route_simulation'],[{expiresAt:new Date(Date.now()-1).toISOString()},'route_simulation_stale'],
 [{binding:'other'},'route_binding_mismatch'],[{buyGasEstimateEth:'0.001'},'route_gas_above_allowance'],[{quantity:'300'},'price_above_approved_limit']]){
 await setReport(patch);assert.equal((await evaluateSnipe(plan.id)).reason,reason);
 assert.equal((await sql`select count(*)::int n from paper_fills`)[0].n,0);
}
await setReport();
await sql`update identity_claims set report=${sql.json({...identity,chain:{...identity.chain,blockHash:'0x'+'d'.repeat(64)}})}`;
assert.equal((await evaluateSnipe(plan.id)).reason,'route_binding_mismatch');
await sql`update identity_claims set report=${sql.json(identity)}`;
await sql.unsafe("CREATE FUNCTION fail_route_fill() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$; CREATE TRIGGER fail_route_fill BEFORE INSERT ON paper_fills FOR EACH ROW EXECUTE FUNCTION fail_route_fill();");
await assert.rejects(()=>evaluateSnipe(plan.id));
assert.equal((await sql`select count(*)::int n from purchase_proposals where status='pending_snipe'`)[0].n,0);
assert.equal((await ledgerBook()).balance.cashEth,'1.000000000000000000');
await sql.unsafe('DROP TRIGGER fail_route_fill ON paper_fills; DROP FUNCTION fail_route_fill();');
const results=await Promise.all([evaluateSnipe(plan.id),evaluateSnipe(plan.id)]);assert.ok(results.every(r=>r.status==='filled'));
const [fill]=await sql`select * from paper_fills`;
assert.equal(fill.execution.quantity,'400');assert.equal(fill.execution.fee,'0.021');assert.equal(fill.execution.cost,'0.7001');
assert.equal(fill.execution.model.version,'pons-route-paper-v1');assert.equal(fill.execution.route.blockHash,hash);
let book=await ledgerBook();assert.equal(book.balance.availableCashEth,'0.2999');assert.equal(book.balance.reservedSnipeEth,'0');
assert.equal(Number(book.holdings[0].remainingCost),0.7001);assert.equal(Number(book.holdings[0].remainingQuantity),400);
assert.equal(book.holdings[0].valuationStatus,'market_unavailable');assert.equal(book.holdings[0].currentValue,null);
const restart=spawnSync(process.execPath,['tests/route-paper.integration.mjs','restart',plan.id],{encoding:'utf8'});assert.equal(restart.status,0,restart.stdout+restart.stderr);
assert.equal((await sql`select count(*)::int n from paper_fills`)[0].n,1);
// Reference-model exits still allocate ALL entry cost (including the gas allowance).
const q={chainId:4663,tokenAddress:token,source:'dexscreener',pairId:hash,quoteAddress:'0x'+'0'.repeat(40),priceEth:0.001,priceUsd:2,liquidityUsd:10000,observedAt:new Date().toISOString(),sourceUpdatedAt:null,url:'https://dexscreener.com/robinhood/fixture'};
await sql`insert into market_quotes(token_address,quote,last_attempt_at) values(${token},${sql.json(q)},now())`;
const intent=await previewSell(fill.position_id,50,actor);await confirmSell(intent.id,actor);
book=await ledgerBook();assert.equal(Number(book.holdings[0].remainingCost),0.35005);assert.equal(Number(book.holdings[0].remainingQuantity),200);
const p2=await draftSnipe({projectHandle:'routepaper',deployerAddress:deployer,spendEth:'0.1',maxUnitPriceEth:'0.002',mode:'paper',chainId:4663},actor);
await decideSnipe(p2.id,'arm',actor);await changeCollection(db,'stop',actor);
assert.equal((await evaluateSnipe(p2.id)).status,'cancelled');assert.equal((await ledgerBook()).balance.reservedSnipeEth,'0');
console.log('Route paper integration passed: gas reservations, automatic queue/dedup, no fallback, exact identity binding, stale/price/gas limits, rollback, concurrent/restart exactly-once, partial-exit cost and stop.');
await sql.end();process.exit(0);
