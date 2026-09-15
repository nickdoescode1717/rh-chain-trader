import type {RouteRpc} from "./pons-route.js";
/** The collector's installed fetch guard accounts for every call and enforces /stop. */
export function createRouteRpc(url=process.env.RPC_URL??""):RouteRpc {
  let count=0;
  const methods=new Set(["eth_chainId","eth_getBlockByNumber","eth_getCode","eth_call","eth_simulateV1","eth_gasPrice"]);
  return async(method,params)=>{
    if(!url||!methods.has(method)||++count>20)throw Error("route_rpc_not_permitted");
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},redirect:"error",signal:AbortSignal.timeout(10_000),body:JSON.stringify({jsonrpc:"2.0",id:count,method,params})});
    if(!response.ok)throw Error("provider_simulation_unavailable");
    const body=await response.json() as any;
    if(body.id!==count||body.error||!("result" in body))throw Error("provider_simulation_unavailable");
    return body.result;
  };
}
