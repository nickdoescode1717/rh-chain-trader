/**
 * Log / new-block listener stub.
 * Research ingestion only — never submits transactions or holds keys.
 */
import type { RpcClient } from "./rpc.js";

export async function runListenerLoop(rpc: RpcClient, intervalMs = 15_000) {
  console.log(
    `[collector] listener start (configured=${rpc.configured}, chain=${rpc.chainId})`
  );
  console.log(
    "[collector] Phase 1: stub loop — no private keys, no tx submission"
  );

  for (;;) {
    try {
      const block = await rpc.getBlockNumber();
      if (block != null) {
        console.log(`[collector] head block ${block}`);
        await rpc.getLogs({ fromBlock: block, toBlock: block });
      } else {
        console.log(
          "[collector] idle tick (set RPC_URL to enable read-only polling)"
        );
      }
    } catch (err) {
      console.error("[collector] tick error", err);
    }
    await sleep(intervalMs);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
