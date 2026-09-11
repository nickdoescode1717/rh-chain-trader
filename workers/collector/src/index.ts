import {createDb} from "@rh/db";
import {installCollectionControl,waitForCollection} from "./collection-control.js";
import { createRpcClient } from "./rpc.js";
import { runListenerLoop } from "./listener.js";
import { runWalletWatcherLoop } from "./walletWatcher.js";
import { runSocialLoop } from "./social/index.js";
import { runProjectResearchLoop } from "./research/loop.js";
import { runMarketLoop } from "./market.js";
import { runIdentityLoop } from "./identity.js";
import { runWatchLoop } from "./research/watch-loop.js";
import { runLaunchPreparationLoop } from "./launch-preparation.js";

// Paper / research only — never honor trading or tx submission flags.
if (
  process.env.ENABLE_TRADING === "true" ||
  process.env.ENABLE_TX_SUBMISSION === "true"
) {
  console.warn(
    "[collector] trading / tx flags ignored — research collector never submits txs"
  );
}

if (!process.env.DATABASE_URL) throw new Error("Collection requires persistent controls");
installCollectionControl(createDb(process.env.DATABASE_URL));
const rpc = createRpcClient();

// Factory launch ingest (corroboration) + watched-wallet Transfer poller (empty-ready).
async function supervise(task: () => Promise<void>, rpc = false) { for (;;) { await waitForCollection(rpc); try { await task(); return; } catch { await new Promise(r => setTimeout(r, 30000)); } } }
await Promise.all([supervise(()=>runListenerLoop(rpc),true),supervise(()=>runWalletWatcherLoop(rpc),true),supervise(runSocialLoop),supervise(runProjectResearchLoop),supervise(()=>runMarketLoop(rpc),true),supervise(runIdentityLoop,true),supervise(runWatchLoop),supervise(runLaunchPreparationLoop)]);

