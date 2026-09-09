import { createRpcClient } from "./rpc.js";
import { runListenerLoop } from "./listener.js";

if (process.env.ENABLE_TRADING === "true" || process.env.ENABLE_TX_SUBMISSION === "true") {
  console.warn(
    "[collector] trading flags ignored — Phase 1 research collector only"
  );
}

const rpc = createRpcClient();
await runListenerLoop(rpc);
