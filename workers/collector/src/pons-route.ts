import {createHash} from "node:crypto";
import {decimal,units,PONS_V2_LAUNCH_FACTORY,type RouteReport,type RouteSellReport} from "@rh/core";
import {PONS_MANIFEST} from "./pons-manifest.js";

export type RouteRpc = (method:string,params:unknown[])=>Promise<any>;
export const SIMULATION_WALLET="0x00000000000000000000000000000000c0de4663";
const address=(s:unknown):string=>{if(typeof s!=="string"||!/^0x[0-9a-f]{40}$/i.test(s))throw Error("invalid_address");return s.toLowerCase();};
const hex=(n:bigint)=>"0x"+n.toString(16);
const word=(s:string|bigint)=> (typeof s==="bigint"?s.toString(16):s.replace(/^0x/,"")).padStart(64,"0");
const words=(s:unknown)=>{if(typeof s!=="string"||!/^0x(?:[0-9a-f]{64})*$/i.test(s))throw Error("invalid_abi_response");return s.slice(2).match(/.{64}/g)??[];};
const uint=(s:unknown)=>{if(typeof s!=="string"||!/^0x[0-9a-f]+$/i.test(s))throw Error("invalid_rpc_quantity");return BigInt(s);};
const addrWord=(s:string)=>{if(!/^0{24}[0-9a-f]{40}$/i.test(s))throw Error("invalid_abi_address");return address("0x"+s.slice(24));};
const digest=(code:string)=>createHash("sha256").update(Buffer.from(code.replace(/^0x/,""),"hex")).digest("hex");
const fail=(reason:string):never=>{throw Error(reason);};
export type Manifest = {factorySha256:string;artifacts:Record<string,{length:number;sha256:string;immutables:readonly {start:number;length:number}[]}>;selectors:Record<string,string>;topics:Record<string,string>};
export function matchesArtifact(code:unknown,artifact:Manifest["artifacts"][string]) {
  if(typeof code!=="string"||!/^0x(?:[0-9a-f]{2})+$/i.test(code))return false;
  const bytes=Buffer.from(code.slice(2),"hex");if(bytes.length!==artifact.length)return false;
  for(const r of artifact.immutables)bytes.fill(0,r.start,r.start+r.length);
  return digest(bytes.toString("hex"))===artifact.sha256;
}
/** Only static, exact-mainnet native-ETH curve trades. No user-supplied routing/calldata. */
export async function inspectPonsRoute(input:{tokenAddress:string;deployerAddress:string;budgetEth:string;maxUnitPriceEth:string},rpc:RouteRpc,manifest:Manifest=PONS_MANIFEST):Promise<RouteReport> {
  const report:RouteReport={version:1,venue:"pons-v2-native-curve",status:"failed",reason:"route_check_failed",observedAt:new Date().toISOString(),chainId:4663,
    ...input,simulationWallet:SIMULATION_WALLET,limitations:["Hypothetical unfunded wallet; no transaction broadcast.","One simulated block; future execution and sellability can change.","Gas estimate excludes Robinhood L1 data fees and future gas-price changes.","Curve only: graduation, ERC-20 quote assets and other venues are unsupported.","Only a fresh identity-bound result can settle a separately armed policy-v2 paper plan."]};
  const factory=PONS_V2_LAUNCH_FACTORY.toLowerCase(),wallet=SIMULATION_WALLET;
  const data=(signature:string,...args:(string|bigint)[])=>{const selector=manifest.selectors[signature];if(!/^0x[0-9a-f]{8}$/.test(selector??""))throw Error("unsupported_abi");return selector+args.map(word).join("");};
  try {
    const token=address(input.tokenAddress),deployer=address(input.deployerAddress);
    if(!/^\d+(\.\d{1,18})?$/.test(input.budgetEth)||!/^\d+(\.\d{1,18})?$/.test(input.maxUnitPriceEth))fail("invalid_limits");
    const amount=units(input.budgetEth),limit=units(input.maxUnitPriceEth);
    if(amount<=0n||limit<=0n||amount>=1n<<128n)fail("invalid_limits");
    if(uint(await rpc("eth_chainId",[]))!==4663n)fail("wrong_chain");
    const block=await rpc("eth_getBlockByNumber",["latest",false]);
    if(!/^0x[0-9a-f]{64}$/i.test(block?.hash??""))fail("invalid_block");
    const number=uint(block.number),timestamp=uint(block.timestamp),tag=hex(number);
    if(number>BigInt(Number.MAX_SAFE_INTEGER)||timestamp>BigInt(Number.MAX_SAFE_INTEGER)||Date.now()/1000-Number(timestamp)>90||Number(timestamp)>Date.now()/1000+5)fail("stale_chain_head");
    Object.assign(report,{blockNumber:Number(number),blockHash:block.hash.toLowerCase(),blockTimestamp:Number(timestamp),expiresAt:new Date((Number(timestamp)+60)*1000).toISOString()});
    const factoryCode=await rpc("eth_getCode",[factory,tag]);
    if(typeof factoryCode!=="string"||!/^0x(?:[0-9a-f]{2})+$/i.test(factoryCode)||digest(factoryCode)!==manifest.factorySha256)fail("unsupported_factory_bytecode");
    const launched=words(await rpc("eth_call",[{to:factory,data:data("getLaunchedToken(address)",token)},tag]));
    if(launched.length!==15||BigInt("0x"+launched[14])!==1n||addrWord(launched[0])!==token||addrWord(launched[2])!==deployer)fail("factory_identity_mismatch");
    if(BigInt("0x"+launched[4])!==0n)fail("unsupported_quote_asset");
    if(BigInt("0x"+launched[10])!==0n)fail("unsupported_graduated_route");
    const curve=addrWord(launched[1]);report.curveAddress=curve;
    for(const [target,name] of [[curve,"PonsV2BondingCurve"],[token,"PonsV2LauncherToken"]]){
      const artifact=manifest.artifacts[name!];if(!artifact||!matchesArtifact(await rpc("eth_getCode",[target!,tag]),artifact))fail("unsupported_"+name+"_bytecode");
    }
    const read=async(to:string,signature:string,...args:(string|bigint)[])=>{const result=words(await rpc("eth_call",[{to,data:data(signature,...args)},tag]));if(result.length!==1)fail("invalid_abi_response");return result as [string];};
    if(addrWord((await read(curve,"factory()"))[0])!==factory||addrWord((await read(curve,"token()"))[0])!==token)fail("curve_identity_mismatch");
    if(BigInt("0x"+(await read(token,"decimals()"))[0])!==18n)fail("unsupported_token_decimals");
    if(await rpc("eth_getCode",[wallet,tag])!=="0x"||BigInt("0x"+(await read(token,"balanceOf(address)",wallet))[0])!==0n)fail("simulation_wallet_not_empty");
    // Never select an exempt wallet to obtain a misleading untaxed launch result.
    if(BigInt("0x"+(await read(curve,"snipeTaxExempt(address)",wallet))[0])!==0n)fail("simulation_wallet_exempt");
    // eth_simulateV1 advances the timestamp. Never silently quote a lower next-second
    // launch tax as though it applied to a same-second Arbitrum transaction.
    if(BigInt("0x"+(await read(curve,"currentSnipeTaxBps(address)",wallet))[0])!==0n)fail("launch_tax_window_active");
    const minimum=(amount*10n**18n+limit-1n)/limit;
    const buy={to:curve,data:data("buy(uint256,uint256,address)",amount,minimum,wallet),value:hex(amount)};
    const balance={to:token,data:data("balanceOf(address)",wallet),value:"0x0"};
    const simulate=async(calls:{to:string;data:string;value:string}[])=>{
      const result=await rpc("eth_simulateV1",[{blockStateCalls:[{blockOverrides:{number:hex(number+1n),time:hex(timestamp+1n)},stateOverrides:{[wallet]:{balance:hex(amount+10n**18n)}},calls:calls.map(c=>({...c,from:wallet,gas:"0x4c4b40"}))}],validation:false,traceTransfers:false},tag]);
      const b=Array.isArray(result)&&result.length===1?result[0]:null;
      if(!b||uint(b.number)!==number+1n||uint(b.timestamp)!==timestamp+1n||!Array.isArray(b.calls)||b.calls.length!==calls.length)fail("invalid_simulation_response");
      return b.calls as any[];
    };
    const quoted=await simulate([buy,balance]);
    if(quoted.some(c=>c.status!=="0x1"))fail("buy_simulation_reverted");
    const quantity=BigInt("0x"+words(quoted[0].returnData)[0]);
    if(quantity<=0n||quantity!==BigInt("0x"+words(quoted[1].returnData)[0])||quantity<minimum)fail("buy_output_mismatch_or_partial_fill");
    const approve={to:token,data:data("approve(address,uint256)",curve,quantity),value:"0x0"};
    const sell={to:curve,data:data("sell(uint256,uint256,address)",quantity,1n,wallet),value:"0x0"};
    const round=await simulate([buy,balance,approve,sell,balance]);
    if(round.some(c=>c.status!=="0x1"))fail("round_trip_reverted_or_graduated");
    if(BigInt("0x"+words(round[0].returnData)[0])!==quantity||BigInt("0x"+words(round[1].returnData)[0])!==quantity||BigInt("0x"+words(round[2].returnData)[0])!==1n||BigInt("0x"+words(round[4].returnData)[0])!==0n)fail("round_trip_balance_mismatch");
    const event=(call:any,signature:string)=>{
      const logs=(call.logs??[]).filter((l:any)=>l.address?.toLowerCase()===curve&&l.topics?.[0]?.toLowerCase()===manifest.topics[signature]);
      if(logs.length!==1||logs[0].topics.length!==3||addrWord(logs[0].topics[1].slice(2))!==wallet||addrWord(logs[0].topics[2].slice(2))!==wallet)fail("trade_event_mismatch");
      const values=words(logs[0].data);if(values.length!==4)fail("trade_event_mismatch");return values.map(w=>BigInt("0x"+w));
    };
    const bought=event(round[0],"CurveBuy"),sold=event(round[3],"CurveSell");
    const net=BigInt("0x"+words(round[3].returnData)[0]);
    if(bought[0]!==amount||bought[1]!==quantity||sold[0]!==quantity||sold[1]!==net||net<=0n||net>amount||bought[2]+bought[3]>=amount)fail("trade_amount_mismatch_or_partial_fill");
    const gas=[0,2,3].reduce((total,i)=>total+uint(round[i].gasUsed),0n);
    const gasPrice=uint(await rpc("eth_gasPrice",[]));
    report.buyGasEstimateEth=decimal(uint(round[0].gasUsed)*gasPrice);
    const canonical=await rpc("eth_getBlockByNumber",[tag,false]);
    if(canonical?.hash?.toLowerCase()!==report.blockHash)fail("simulation_block_reorg");
    if(Date.now()>Date.parse(report.expiresAt!))fail("simulation_expired");
    Object.assign(report,{status:"passed",reason:"round_trip_simulated",quantity:decimal(quantity),spendEth:decimal(amount),buyFeeEth:decimal(bought[2]),creatorTaxEth:decimal(bought[3]),sellReturnEth:decimal(net),roundTripLossEth:decimal(amount-net),gasUnits:gas.toString(),executionGasEstimateEth:decimal(gas*gasPrice),buy,approve,sell:{...sell,data:data("sell(uint256,uint256,address)",quantity,net*9950n/10000n||1n,wallet)}});
  } catch(e) {
    const message=e instanceof Error?e.message:"route_check_failed";
    const known=/^[a-zA-Z0-9_]{1,100}$/.test(message)&&/^(unsupported_|invalid_|wrong_chain|stale_chain_head|factory_identity|curve_identity|simulation_|buy_|round_trip_|trade_|launch_tax_)/.test(message);
    report.reason=known?message:"provider_simulation_unavailable";
    report.status=report.reason.startsWith("unsupported_")||report.reason==="provider_simulation_unavailable"?"unsupported":"blocked";
  }
  return report;
}

/**
 * Prices a sell from pinned, verified Pons V2 source and current canonical
 * reserves. This is deliberately read-only: it never overrides token balances,
 * impersonates a holder, signs, or submits a transaction.
 */
export async function inspectPonsSellRoute(input:{tokenAddress:string;deployerAddress:string;quantity:string},rpc:RouteRpc,manifest:Manifest=PONS_MANIFEST):Promise<RouteSellReport>{
  const report:RouteSellReport={version:1,venue:"pons-v2-native-curve",status:"failed",reason:"route_sell_check_failed",observedAt:new Date().toISOString(),
    chainId:4663,...input,simulationWallet:SIMULATION_WALLET,limitations:["Read-only exact curve math at one canonical block; no transaction broadcast.",
      "Future reserves and sellability can change before execution.","Exit gas and Robinhood L1 data fees are excluded from paper P&L.",
      "Curve only: graduated launches, ERC-20 quote assets and other venues are unsupported."]};
  const factory=PONS_V2_LAUNCH_FACTORY.toLowerCase();
  const data=(signature:string,...args:(string|bigint)[])=>{const selector=manifest.selectors[signature];if(!/^0x[0-9a-f]{8}$/.test(selector??""))throw Error("unsupported_abi");return selector+args.map(word).join("");};
  try{
    const token=address(input.tokenAddress),deployer=address(input.deployerAddress);
    if(!/^\d+(\.\d{1,18})?$/.test(input.quantity))fail("invalid_sell_quantity");
    const quantity=units(input.quantity);if(quantity<=0n)fail("invalid_sell_quantity");
    if(uint(await rpc("eth_chainId",[]))!==4663n)fail("wrong_chain");
    const block=await rpc("eth_getBlockByNumber",["latest",false]);
    if(!/^0x[0-9a-f]{64}$/i.test(block?.hash??""))fail("invalid_block");
    const number=uint(block.number),timestamp=uint(block.timestamp),tag=hex(number);
    if(number>BigInt(Number.MAX_SAFE_INTEGER)||timestamp>BigInt(Number.MAX_SAFE_INTEGER)||Date.now()/1000-Number(timestamp)>90||Number(timestamp)>Date.now()/1000+5)fail("stale_chain_head");
    Object.assign(report,{blockNumber:Number(number),blockHash:block.hash.toLowerCase(),blockTimestamp:Number(timestamp),expiresAt:new Date((Number(timestamp)+60)*1000).toISOString()});
    const factoryCode=await rpc("eth_getCode",[factory,tag]);
    if(typeof factoryCode!=="string"||!/^0x(?:[0-9a-f]{2})+$/i.test(factoryCode)||digest(factoryCode)!==manifest.factorySha256)fail("unsupported_factory_bytecode");
    const launched=words(await rpc("eth_call",[{to:factory,data:data("getLaunchedToken(address)",token)},tag]));
    if(launched.length!==15||BigInt("0x"+launched[14])!==1n||addrWord(launched[0])!==token||addrWord(launched[2])!==deployer)fail("factory_identity_mismatch");
    if(BigInt("0x"+launched[4])!==0n)fail("unsupported_quote_asset");
    if(BigInt("0x"+launched[10])!==0n)fail("unsupported_graduated_route");
    const curve=addrWord(launched[1]);report.curveAddress=curve;
    for(const [target,name] of [[curve,"PonsV2BondingCurve"],[token,"PonsV2LauncherToken"]]){
      const artifact=manifest.artifacts[name!];if(!artifact||!matchesArtifact(await rpc("eth_getCode",[target!,tag]),artifact))fail("unsupported_"+name+"_bytecode");
    }
    const call=async(to:string,signature:string,...args:(string|bigint)[])=>words(await rpc("eth_call",[{to,data:data(signature,...args)},tag]));
    const one=async(to:string,signature:string,...args:(string|bigint)[])=>{const result=await call(to,signature,...args);if(result.length!==1)fail("invalid_abi_response");return BigInt("0x"+result[0]);};
    const oneAddress=async(to:string,signature:string)=>{const result=await call(to,signature);if(result.length!==1)fail("invalid_abi_response");return addrWord(result[0]!);};
    if(await oneAddress(curve,"factory()")!==factory||await oneAddress(curve,"token()")!==token)fail("curve_identity_mismatch");
    if(await oneAddress(curve,"pairToken()")!=="0x0000000000000000000000000000000000000000")fail("unsupported_quote_asset");
    if(await one(curve,"graduated()")!==0n||await one(curve,"readyToGraduate()")!==0n)fail("unsupported_graduated_route");
    if(await one(token,"decimals()")!==18n)fail("unsupported_token_decimals");
    const reserves=await call(curve,"getReserves()");if(reserves.length!==2)fail("invalid_abi_response");
    const quoteReserve=BigInt("0x"+reserves[0]),tokenReserve=BigInt("0x"+reserves[1]);
    const feeBps=await one(curve,"feeBps()"),creatorTaxBps=await one(curve,"creatorTaxBps()");
    if(feeBps>1000n||creatorTaxBps>1000n||feeBps+creatorTaxBps>2000n||quoteReserve<=0n||tokenReserve<=0n)fail("invalid_curve_state");
    if(await one(token,"balanceOf(address)",curve)!==tokenReserve)fail("curve_token_balance_mismatch");
    const gross=quantity*quoteReserve/(tokenReserve+quantity);if(gross<=0n)fail("sell_amount_below_precision");
    const fee=gross*feeBps/10000n,tax=gross*creatorTaxBps/10000n,net=gross-fee-tax;
    if(net<=0n||await one(curve,"realQuoteReserve()")<net)fail("insufficient_real_quote_reserve");
    const canonical=await rpc("eth_getBlockByNumber",[tag,false]);
    if(canonical?.hash?.toLowerCase()!==report.blockHash)fail("simulation_block_reorg");
    if(Date.now()>Date.parse(report.expiresAt!))fail("simulation_expired");
    Object.assign(report,{status:"passed",reason:"exact_curve_reserve_quote",quantity:decimal(quantity),tokenReserve:decimal(tokenReserve),quoteReserveEth:decimal(quoteReserve),
      grossQuoteEth:decimal(gross),baseFeeEth:decimal(fee),creatorTaxEth:decimal(tax),netQuoteEth:decimal(net),feeBps:Number(feeBps),creatorTaxBps:Number(creatorTaxBps)});
  }catch(e){
    const message=e instanceof Error?e.message:"route_sell_check_failed";
    const known=/^[a-zA-Z0-9_]{1,100}$/.test(message)&&/^(unsupported_|invalid_|wrong_chain|stale_chain_head|factory_identity|curve_identity|curve_token|sell_|insufficient_|simulation_)/.test(message);
    report.reason=known?message:"provider_simulation_unavailable";
    report.status=report.reason.startsWith("unsupported_")||report.reason==="provider_simulation_unavailable"?"unsupported":"blocked";
  }
  return report;
}
