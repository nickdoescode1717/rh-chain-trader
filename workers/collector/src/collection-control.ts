import { collectionState, permitCollection, pauseRpcProvider, type Db } from "@rh/db";
let database: Db | null = null;
let all = new AbortController(), chain = new AbortController();
export async function collectionPermit() { if (database) { await permitCollection(database); if (all.signal.aborted) all = new AbortController(); } }
export const collectionSignal = (): AbortSignal => all.signal;
export async function waitForCollection(rpc = false) {
  if (!database) return;
  for (;;) {
    try { const s = await collectionState(database); if (!s.paused && (!rpc || s.chainEnabled && s.rpcRequestsToday < s.rpcDailyRequestLimit && (!s.rpcBlockedUntil || Date.parse(String(s.rpcBlockedUntil)) <= Date.now()))) return; } catch { /* fail closed */ }
    await new Promise(r => setTimeout(r, 5000));
  }
}
export function installCollectionControl(db: Db) {
  database = db;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const rpc = !!process.env.RPC_URL && new URL(url).href === new URL(process.env.RPC_URL).href;
    let method = "unknown";
    if (rpc) { try { method = JSON.parse(String(init?.body)).method ?? method; } catch { /* count unknown */ } }
    await permitCollection(db, rpc ? method : undefined);
    // A freshly authorized resume must not inherit an already-aborted controller.
    if (all.signal.aborted) all = new AbortController();
    if (rpc && chain.signal.aborted) chain = new AbortController();
    const signals = [all.signal, AbortSignal.timeout(15_000), ...(rpc ? [chain.signal] : []), ...(init?.signal ? [init.signal] : []), ...(input instanceof Request ? [input.signal] : [])];
    const response = await original(input, { ...init, redirect: "error", signal: AbortSignal.any(signals) });
    if (rpc && [401,402,403,429].includes(response.status)) await pauseRpcProvider(db);
    return response;
  };
  const tick = async () => {
    try {
      const s = await collectionState(db);
      if (s.paused) { all.abort(); } else if (all.signal.aborted) all = new AbortController();
      if (s.paused || !s.chainEnabled || s.rpcRequestsToday >= s.rpcDailyRequestLimit || s.rpcBlockedUntil && Date.parse(String(s.rpcBlockedUntil)) > Date.now()) chain.abort();
      else if (chain.signal.aborted) chain = new AbortController();
    } catch { all.abort(); chain.abort(); }
    setTimeout(tick, 2000).unref();
  };
  void tick();
}
export async function rpcProviderBackoff() { if (database) await pauseRpcProvider(database); }

