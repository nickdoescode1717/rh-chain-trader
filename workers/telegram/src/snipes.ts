import type { ApiClient, SnipePlan } from "./api.js";
import type { BotCard } from "./research.js";
import type { AlertStore } from "./research-alerts.js";
type API = Pick<ApiClient,"listSnipes"|"draftSnipe"|"decideSnipe">;
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g," ").slice(0,250);
const button = (text: string, callback_data: string) => ({text,callback_data});
export function snipeHelp(handle = "account"): BotCard {
  return {text:`PAPER SNIPE PLAN\n\n/snipe @${handle} ETH_BUDGET MAX_PRICE_ETH DEPLOYER [HOURS]\n\nUse the intended mainnet deployer wallet, not a testnet token CA, owner guess or CREATE2 factory. Use /launch @${handle} for DD first.\n\nThe next screen shows the exact limits before you arm anything. Default expiry: 24h. Your maximum price is per token in ETH including modeled slippage. No real funds are spent.\n\n/snipes — saved plans. /stop cancels armed plans. Source review is still required in Telegram.`};
}
export function formatSnipe(p: SnipePlan): BotCard {
  const t = p.terms;
  return {text:[`PAPER SNIPE · @${clean(t.projectHandle)}`,`Status: ${clean(p.status.toUpperCase())}`,`Current check: ${clean(p.reason.replaceAll("_"," "))}`,
    `Network: Robinhood MAINNET 4663 · simulated only`, `Project domain: ${clean(t.domain)}`, `Expected deployer: ${clean(t.deployerAddress)}`,
    `Reserve / spend once: ${t.spendEth} ETH`, `Maximum modeled price: ${t.maxUnitPriceEth} ETH/token`, `Minimum quoted liquidity: $${t.minLiquidityUsd}`,
    p.expiresAt ? `Expires: ${p.expiresAt}` : `Valid for ${t.hours}h after arming; confirm this draft within 10 minutes.`,
    ...(p.tokenAddress ? [`Mainnet CA: ${p.tokenAddress}`] : ["CA: wait for independently verified mainnet deployment"]),
    "\nArming reserves paper funds and authorizes ONE automatic paper buy after every gate passes. Launch must occur after arming; entry window is 10 minutes after deployment.",
    "Pons V2 targeted checks: every ~10s for the first 10 minutes after arming (roughly 120 RPC calls plus chain checks; shared cap applies). Then normal monitoring. No first-block guarantee.",
    "Requires fresh owner-reviewed identity and market data. Quote/model only: 0.3% fee + 0.5% slippage; gas, taxes and sellability are not simulated. No automated exits or real transaction.",
    "\n/stop, /chainoff and /run cancel armed plans. Resuming collection never re-arms them."].join("\n"), reply_markup:{inline_keyboard:[
      ...(p.status === "draft" ? [[button("Arm paper plan",`snipe:arm:${p.id}`)]] : []),
      ...(["draft","armed"].includes(p.status) ? [[button("Cancel plan",`snipe:cancel:${p.id}`)]] : []),
      [button("Refresh",`snipe:show:${p.id}`),button("All plans","snipe:list:0")],
      [button("Identity review",`identity:list:${t.projectHandle}`)],
    ]}};
}
export async function handleSnipeInput(api: API,input: string,actor: string): Promise<BotCard|null> {
  const [command,...args] = input.trim().split(/\s+/), base = command.toLowerCase().split("@")[0];
  if (!input.startsWith("snipe:") && !["/snipe","/snipes"].includes(base)) return null;
  try {
    if (base === "/snipe") {
      if (args.length < 4 || args.length > 5) return snipeHelp((args[0] ?? "account").replace(/^@/,""));
      const projectHandle=args[0].replace(/^@/,"").toLowerCase();
      if (!/^[a-z0-9_]{1,15}$/.test(projectHandle)) return snipeHelp();
      return formatSnipe(await api.draftSnipe({projectHandle,spendEth:args[1],maxUnitPriceEth:args[2],deployerAddress:args[3],hours:Number(args[4]??24),mode:"paper",chainId:4663,actor}));
    }
    const [,action,id] = input.split(":");
    if (action === "help") return snipeHelp(/^[a-z0-9_]{1,15}$/.test(id??"") ? id : "account");
    if (["arm","cancel","show"].includes(action)) {
      if (!/^[a-f0-9-]{36}$/.test(id??"")) return {text:"Use /snipes to open a plan."};
      const p = action === "show" ? (await api.listSnipes()).find(p=>p.id===id) : await api.decideSnipe(id,action as "arm"|"cancel",actor);
      return p ? formatSnipe(p) : {text:"Plan not found. Use /snipes."};
    }
    const plans = await api.listSnipes();
    return {text:["PAPER SNIPE PLANS",...plans.slice(0,10).map(p=>`@${p.terms.projectHandle} · ${p.status} · ${p.terms.spendEth} ETH`),
      "\nCreate: /snipe @account ETH_BUDGET MAX_PRICE_ETH DEPLOYER [HOURS]"].join("\n"),reply_markup:{inline_keyboard:plans.slice(0,10).map(p=>[button(`@${p.terms.projectHandle} · ${p.status}`,`snipe:show:${p.id}`)])}};
  } catch (e) { return {text:`Paper plan not confirmed: ${clean(e instanceof Error ? e.message.replaceAll("_"," ") : "service unavailable")}. Use /snipes to check. No live transaction was sent.`}; }
}
export function createSnipeAlerts(api: Pick<ApiClient,"listSnipes">,store: AlertStore,send: (card:BotCard)=>Promise<void>) {
  let state=store.load();
  return async () => { let sent=0; for(const p of await api.listSnipes()) {
    if(p.status==="draft")continue;
    const signature=JSON.stringify([p.status,p.reason,p.tokenAddress,p.fillId]);
    if(state[p.id]?.signature===signature)continue;
    if(sent++>=5)break;
    await send(formatSnipe(p)); const next={...state,[p.id]:{signature,snapshot:p.createdAt}};store.save(next);state=next;
  }};
}
