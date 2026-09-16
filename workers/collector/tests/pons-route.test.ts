import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {inspectPonsRoute,inspectPonsSellRoute,matchesArtifact,SIMULATION_WALLET,type Manifest} from '../src/pons-route.js';
import {PONS_MANIFEST} from '../src/pons-manifest.js';
import {PONS_V2_LAUNCH_FACTORY,units} from '@rh/core';
const token='0x'+'a'.repeat(40),curve='0x'+'b'.repeat(40),deployer='0x'+'c'.repeat(40),hash='0x'+'d'.repeat(64),wallet=SIMULATION_WALLET;
const word=(v:string|bigint)=> (typeof v==='bigint'?v.toString(16):v.replace(/^0x/,'')).padStart(64,'0');
const encoded=(...v:(string|bigint)[])=>'0x'+v.map(word).join('');
const digest=(v:string)=>createHash('sha256').update(Buffer.from(v.slice(2),'hex')).digest('hex');
const manifest:Manifest={...PONS_MANIFEST,factorySha256:digest('0x6000'),artifacts:{PonsV2BondingCurve:{length:2,sha256:digest('0x6001'),immutables:[]},PonsV2LauncherToken:{length:2,sha256:digest('0x6002'),immutables:[]}}};
const input={tokenAddress:token,deployerAddress:deployer,budgetEth:'0.01',maxUnitPriceEth:'0.001'};
function fixture(change:string='') {
 const seen:string[]=[];let simulation=0;const timestamp=Math.floor(Date.now()/1000)-(change==='stale'?120:0);
 const rpc=async(method:string,params:any[]):Promise<any>=>{
  seen.push(method);
  if(method==='eth_chainId')return change==='chain'?'0x1':'0x1237';
  if(method==='eth_getBlockByNumber')return {number:'0x64',timestamp:'0x'+timestamp.toString(16),hash:change==='reorg'&&params[0]!=='latest'?'0x'+'e'.repeat(64):hash};
  if(method==='eth_getCode')return params[0]===PONS_V2_LAUNCH_FACTORY.toLowerCase()?(change==='factory'?'0x6009':'0x6000'):params[0]===curve?(change==='curve'?'0x6009':'0x6001'):params[0]===token?'0x6002':'0x';
  if(method==='eth_gasPrice')return '0x3b9aca00';
  if(method==='eth_call'){
   const d=params[0].data;
   if(d.startsWith(manifest.selectors['getLaunchedToken(address)']))return encoded(token,curve,change==='deployer'?token:deployer,deployer,change==='quote'?token:0n,1n,100n,10n,0n,0n,change==='graduated'?1n:0n,0n,0n,0n,1n);
   if(d.startsWith(manifest.selectors['factory()']))return encoded(PONS_V2_LAUNCH_FACTORY.toLowerCase());
   if(d.startsWith(manifest.selectors['token()']))return encoded(token);
   if(d.startsWith(manifest.selectors['pairToken()']))return encoded(0n);
   if(d.startsWith(manifest.selectors['graduated()']))return encoded(change==='graduated'?1n:0n);
   if(d.startsWith(manifest.selectors['readyToGraduate()']))return encoded(change==='ready'?1n:0n);
   if(d.startsWith(manifest.selectors['getReserves()']))return encoded(units('10'),units('1000'));
   if(d.startsWith(manifest.selectors['realQuoteReserve()']))return encoded(units(change==='thin'?'0.01':'5'));
   if(d.startsWith(manifest.selectors['feeBps()']))return encoded(100n);
   if(d.startsWith(manifest.selectors['creatorTaxBps()']))return encoded(200n);
   if(d.startsWith(manifest.selectors['decimals()']))return encoded(change==='decimals'?6n:18n);
   if(d.startsWith(manifest.selectors['snipeTaxExempt(address)']))return encoded(change==='exempt'?1n:0n);
   if(d.startsWith(manifest.selectors['currentSnipeTaxBps(address)']))return encoded(change==='launchTax'?9900n:0n);
   if(d.startsWith(manifest.selectors['balanceOf(address)']))return encoded(d.endsWith(word(curve))?(change==='tokenBalance'?units('999'):units('1000')):(change==='balance'?1n:0n));
   throw Error('unexpected_call');
  }
  if(method==='eth_simulateV1'){
   simulation++;const opts=params[0],b=opts.blockStateCalls[0];
   assert.equal(opts.validation,false);assert.deepEqual(Object.keys(b.stateOverrides),[wallet]);assert.deepEqual(Object.keys(b.stateOverrides[wallet]),['balance']);
   assert.equal(params[1],'0x64');assert.equal(b.calls[0].to,curve);assert.equal(b.calls[0].value,'0x'+units('0.01').toString(16));assert.equal(b.calls[0].from,wallet);
   const quantity=units(change==='quantity'&&simulation===2?'99':'100');
   const event=(name:string,...values:bigint[])=>({address:curve,topics:[manifest.topics[name],'0x'+word(wallet),'0x'+word(wallet)],data:encoded(...values)});
   const ok=(v:bigint,logs:any[]=[])=>({status:'0x1',returnData:encoded(v),gasUsed:'0x186a0',logs});
   const buy=ok(quantity,[event('CurveBuy',units(change==='partial'?'0.009':'0.01'),quantity,units('0.0001'),units('0.0002'))]);
   const result=simulation===1?[buy,ok(quantity)]:[buy,ok(quantity),ok(1n),ok(units('0.0094'),[event('CurveSell',quantity,units('0.0094'),units('0.0001'),units('0.0001'))]),ok(0n)];
   if(change==='buy')result[0].status='0x0';
   if(simulation===2&&change==='sell')result[3].status='0x0';
   if(simulation===2&&change==='approve')result[2].status='0x0';
   if(change==='malformed')return [];
   return [{number:b.blockOverrides.number,timestamp:b.blockOverrides.time,calls:result}];
  }
  throw Error('unexpected_method');
 };
 return {rpc,seen};
}
test('native curve adapter binds factory and issuer, simulates sequential buy/approve/sell, records fees and bounds calldata',async()=>{
 const f=fixture(),r=await inspectPonsRoute(input,f.rpc,manifest);assert.equal(r.status,'passed',r.reason);
 assert.equal(r.quantity,'100');assert.equal(r.buyFeeEth,'0.0001');assert.equal(r.creatorTaxEth,'0.0002');assert.equal(r.sellReturnEth,'0.0094');assert.equal(r.roundTripLossEth,'0.0006');assert.equal(r.gasUnits,'300000');assert.equal(r.buyGasEstimateEth,'0.0001');assert.equal(r.executionGasEstimateEth,'0.0003');
 assert.equal(r.approve?.to,token);assert.equal(r.sell?.to,curve);assert.equal(r.buy?.value,'0x'+units('0.01').toString(16));
 assert.equal(f.seen.filter(x=>x==='eth_simulateV1').length,2);assert.ok(f.seen.length<=20);assert.ok(!f.seen.some(x=>/send|sign/i.test(x)));
});
test('unsupported routes, copycats, exempt wallets, stale state and reverted or partial trades never pass',async()=>{
 for(const change of ['chain','factory','curve','deployer','quote','graduated','decimals','exempt','launchTax','balance','stale','reorg','buy','sell','approve','partial','quantity','malformed']){
  const r=await inspectPonsRoute(input,fixture(change).rpc,manifest);assert.notEqual(r.status,'passed',change);
 }
 const expensive=await inspectPonsRoute({...input,maxUnitPriceEth:'0.000001'},fixture().rpc,manifest);assert.notEqual(expensive.status,'passed');
});
test('bytecode masks only constructor immutable positions, rejecting modified instructions',()=>{
 const artifact={length:4,sha256:digest('0x60000001'),immutables:[{start:1,length:2}]};
 assert.ok(matchesArtifact('0x60ffaa01',artifact));assert.ok(!matchesArtifact('0x61ffaa01',artifact));assert.ok(!matchesArtifact('0x60ff01',artifact));
});
test('sell adapter uses exact verified curve reserves and frozen fee terms without simulating or submitting',async()=>{
 const f=fixture(),r=await inspectPonsSellRoute({tokenAddress:token,deployerAddress:deployer,quantity:'100'},f.rpc,manifest);
 assert.equal(r.status,'passed',r.reason);assert.equal(r.grossQuoteEth,'0.90909090909090909');
 assert.equal(r.baseFeeEth,'0.00909090909090909');assert.equal(r.creatorTaxEth,'0.018181818181818181');
 assert.equal(r.netQuoteEth,'0.881818181818181819');assert.equal(r.feeBps,100);assert.equal(r.creatorTaxBps,200);
 assert.ok(!f.seen.includes('eth_simulateV1'));assert.ok(!f.seen.some(x=>/send|sign/i.test(x)));
});
test('sell adapter rejects graduated, drained, mismatched and copycat routes',async()=>{
 for(const change of ['chain','factory','curve','deployer','quote','graduated','ready','decimals','stale','reorg','thin','tokenBalance']){
  const r=await inspectPonsSellRoute({tokenAddress:token,deployerAddress:deployer,quantity:'100'},fixture(change).rpc,manifest);
  assert.notEqual(r.status,'passed',change);
 }
});
