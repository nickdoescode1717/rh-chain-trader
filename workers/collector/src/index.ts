import { createRpcClient } from "./rpc.js";
import { runListenerLoop } from "./listener.js";

// Paper / research only — never honor trading or tx submission flags.
if (
  process.env.ENABLE_TRADING === "true" ||
  process.env.ENABLE_TX_SUBMISSION === "true"
) {
  console.warn(
    "[collector] trading / tx flags ignored — research collector never submits txs"
  );
}

const rpc = createRpcClient();
await runListenerLoop(rpc);
