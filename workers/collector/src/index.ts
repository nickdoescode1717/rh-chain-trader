import { createRpcClient } from "./rpc.js";
import { runListenerLoop } from "./listener.js";
import { runWalletWatcherLoop } from "./walletWatcher.js";
import { runSocialLoop } from "./social/index.js";
import { runProjectResearchLoop } from "./research/loop.js";
import { runMarketLoop } from "./market.js";
import { runIdentityLoop } from "./identity.js";

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

// Factory launch ingest (corroboration) + watched-wallet Transfer poller (empty-ready).
await Promise.all([runListenerLoop(rpc), runWalletWatcherLoop(rpc), runSocialLoop(), runProjectResearchLoop(), runMarketLoop(rpc), runIdentityLoop()]);
