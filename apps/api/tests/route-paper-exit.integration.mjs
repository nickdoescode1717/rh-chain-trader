// Isolated disposable database only. Exercises the two-quote Telegram route-exit lifecycle.
import assert from 'node:assert/strict';
import postgres from 'postgres';
import {Hono} from 'hono';
import {decimal,routePaperSell,units} from '@rh/core';
import {initDb} from '../dist/db.js';
import {paperSellRoutes} from '../dist/routes/paper-sells.js';
import {paperBalanceRoutes} from '../dist/routes/paper-balance.js';
assert.match(new URL(process.env.DATABASE_URL).pathname,/^\/rh_pricing_test_[a-f0-9]{16}$/);
const sql=postgres(process.env.DATABASE_URL);assert.equal((await initDb()).available,true);
const app=new Hono();app.route('/paper-sells',paperSellRoutes);app.route('/paper-balance',paperBalanceRoutes);
const token='0x'+'a'.repeat(40),deployer='0x'+'b'.repeat(40),curve='0x'+'c'.repeat(40);
const entry={currency:'ETH',unitPrice:0.001,quantity:100,capturedAt:new Date().toISOString(),quote:{source:'pons-route-simulation',observedAt:new Date().toISOString(),tokenAddress:token},
 execution:{mode:'paper',side:'buy',quantity:'100',fee:'0.001',cashDelta:'-0.1',executionPrice:'0.001',cost:'0.1',realizedPnl:'0',model:{version:'pons-route-paper-v1'},route:{deployerAddress:deployer}}};
const [position]=await sql`insert into positions(token_address,size,status,entry_snapshot) values(${token},'eth:0.1','simulated_open',${sql.json(entry)}) returning id`;
async function post(path,body={}){const r=await app.request(path,{method:'POST',headers:{'content-type':'application/json','x-telegram-approval-token':process.env.TELEGRAM_APPROVAL_TOKEN},body:JSON.stringify({actor:'telegram:42',...body})});return {status:r.status,body:await r.json()};}
await app.request('/paper-balance');
const first=(await post(`/paper-sells/${position.id}/preview`,{percent:25})).body.data;
assert.equal(first.queued,true);assert.equal(first.phase,'quote');
async function installQuote(id,net,status){
 const [intent]=await sql`select * from paper_sell_intents where id=${id}`;
 const now=Date.now(),blockTimestamp=Math.floor(now/1000),report={version:1,venue:'pons-v2-native-curve',status:'passed',reason:'exact_curve_reserve_quote',observedAt:intent.route_requested_at.toISOString(),expiresAt:new Date((blockTimestamp+50)*1000).toISOString(),requestedAt:intent.route_requested_at.toISOString(),chainId:4663,
  tokenAddress:token,deployerAddress:deployer,quantity:'25',simulationWallet:'0x'+'1'.repeat(40),curveAddress:curve,blockNumber:100,blockHash:'0x'+'d'.repeat(64),blockTimestamp,grossQuoteEth:decimal(units(net)+units('0.003')),baseFeeEth:'0.001',creatorTaxEth:'0.002',netQuoteEth:net,limitations:[]};
 const execution=routePaperSell('100','0.1',25,report,{token,deployer,requestedAt:intent.route_requested_at},now);
 await sql`update paper_sell_intents set route_report=${sql.json(report)},route_checked_at=now(),preview=${sql.json(execution)},minimum_net=${decimal(units(net)*9900n/10000n)},status=${status},expires_at=${report.expiresAt} where id=${id}`;
 return {report,execution};
}
await installQuote(first.id,'0.03','pending');
const preview=(await post(`/paper-sells/${first.id}/status`)).body.data;
assert.equal(preview.queued,false);assert.equal(preview.preview.model.version,'pons-route-paper-sell-v1');assert.equal(preview.preview.cashDelta,'0.03');
const approved=(await post(`/paper-sells/${first.id}/confirm`)).body.data;assert.equal(approved.queued,true);assert.equal(approved.phase,'execution');
await installQuote(first.id,'0.029','execution_ready');
const settled=await Promise.all([post(`/paper-sells/${first.id}/confirm`),post(`/paper-sells/${first.id}/confirm`)]);
assert.ok(settled.every(x=>x.status===200));assert.deepEqual(settled.map(x=>x.body.data.replayed).sort(),[false,true]);
const fill=settled[0].body.data.fill;assert.equal(fill.execution.cashDelta,'0.029');assert.equal(fill.execution.model.version,'pons-route-paper-sell-v1');
assert.equal(fill.quote.source,'pons-v2-exact-reserves');assert.equal((await sql`select count(*)::int n from paper_fills where position_id=${position.id}`)[0].n,1);
const [held]=await sql`select remaining_quantity,remaining_cost,realized_pnl,position_version from positions where id=${position.id}`;
assert.equal(held.remaining_quantity,'75.000000000000000000');assert.equal(held.remaining_cost,'0.075000000000000000');assert.equal(held.realized_pnl,'0.004000000000000000');assert.equal(held.position_version,1);
assert.equal((await sql`select cash from paper_accounts where currency='ETH'`)[0].cash,'0.929000000000000000');
assert.equal((await post(`/paper-sells/${first.id}/status`)).body.data.replayed,true);
console.log('Route paper exit integration passed: queued quote, Telegram preview, fresh approval recheck, exact reserve fill, proportional cost, and concurrent exactly-once settlement.');
await sql.end();process.exit(0);
