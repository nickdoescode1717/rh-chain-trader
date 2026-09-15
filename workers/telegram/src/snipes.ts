import type { ApiClient, SnipePlan } from "./api.js";
import type { BotCard } from "./research.js";
import type { AlertStore } from "./research-alerts.js";
type API = Pick<ApiClient,"listSnipes"|"draftSnipe"|"decideSnipe">;
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g," ").slice(0,250);
const button = (text: string, callback_data: string) => ({text,callback_data});
export function snipeHelp(handle = "account"): BotCard {
  handle = /^[a-z0-9_]{1,15}$/i.test(handle) ? handle.toLowerCase() : "account";
  return {text:["PAPER SNIPE PLAN · setup guide", "",
    `Don't know the launch date or deployer yet? Start with /launch @${handle}. That watch has no expiry while enabled. A snipe plan is a separate, time-limited paper-buy approval.`,
    "", "When you know the intended mainnet deployer, send:",
    `/snipe @${handle} ETH_BUDGET MAX_PRICE_ETH DEPLOYER [HOURS]`,
    "", "Put these values in this exact order:",
    `1. @${handle} — the project's X handle, already added through /launch or /watch.`,
    "2. ETH_BUDGET — total paper ETH to spend once, e.g. 0.01.",
    "3. MAX_PRICE_ETH — most you'll pay for ONE token in ETH, including modeled slippage, e.g. 0.000001. This is not a total budget or market cap.",
    "4. DEPLOYER — the intended mainnet deployer wallet: 0x plus 40 hexadecimal characters. Do not use the token CA, a testnet contract, an owner guess or a shared factory.",
    "5. HOURS — optional whole number: 24 = one day, 168 = one week, 720 = 30 days. Default 24; allowed 1–720. It starts when you arm.",
    "", "Example layout (replace DEPLOYER_WALLET; amounts are illustrative):",
    `/snipe @${handle} 0.01 0.000001 DEPLOYER_WALLET 168`,
    "", "Then: review the draft → enable monitoring with /chainon if needed → tap Arm paper plan. /chainon uses your provider budget; it does not arm a plan.",
    `When a candidate CA appears, review /identity @${handle}. The bot waits for the exact official mainnet identity and price/liquidity checks before ONE paper buy. Deployment alone is not enough.`,
    "", "/snipes — plans and what each is waiting for. /stop cancels armed plans and stops collection. No real funds are spent.",
  ].join("\n"),reply_markup:{inline_keyboard:[[button("Saved plans","snipe:list:0")]]}};
}
const reasons: Record<string,string> = {
  review_required:"Read the limits, then tap Arm paper plan. Nothing is armed yet.",
  waiting_for_verified_mainnet_launch:"Waiting for a new mainnet launch and verified project identity.",
  one_reviewed_mainnet_identity_required:"Open Identity review. Exactly one current mainnet identity must be reviewed in Telegram; if none is found, keep watching the launch DD.",
  enable_chain_collection_before_arming:"Send /chainon to enable paid chain monitoring, then return to this draft and tap Arm paper plan within 10 minutes.",
  watch_project_first:"Add the project with /launch @account first. Wait for its X handle and website to be resolved, then use /snipe with that handle.",
  project_changed_or_paused:"Check /projects and resume the intended project if appropriate. If its domain changed, review it and create a new plan.",
  plan_review_expired_create_again:"This draft is over 10 minutes old or is no longer a draft. Send your /snipe command again and review the new plan.",
  insufficient_unreserved_paper_cash:"Check /balance for available paper ETH. Use a smaller budget or cancel another reservation in /snipes.",
  maximum_five_armed_plans:"Five plans are already armed. Cancel one in /snipes before arming another.",
  project_already_has_armed_plan:"This project already has an armed plan. Open /snipes to view or cancel it.",
  positive_decimal_required:"Budget and maximum price must be positive ETH amounts such as 0.01, with no $ sign, commas or scientific notation.",
  expiry_must_be_1_to_720_hours:"Use a whole number of hours from 1 to 720; omit it for 24 hours.",
  shared_factory_is_not_team_deployer:"Use the team's actual mainnet deployer wallet, not the shared CREATE2 or Pons factory. Check the launch DD.",
  deployer_does_not_match_approved_plan:"The candidate's deployer differs from your approved wallet. Review Identity; this plan cannot buy that candidate.",
  deployment_must_follow_arming:"Waiting for a deployment after this plan was armed. An older token cannot trigger this plan.",
  launch_entry_window_expired:"The 10-minute entry window after deployment passed. No late buy will be made.",
  plan_expired:"Your approved watch duration ended. Funds are released; create and arm a new plan to continue conditional paper buying.",
  collection_disabled:"Collection was stopped or chain monitoring disabled. This plan is cancelled; /chainon alone will not re-arm it.",
  rpc_provider_cooldown:"The RPC provider is in cooldown. Check /status and /usage; monitoring may be delayed.",
  rpc_daily_limit_reached:"Today's RPC request cap is reached. Check /usage. Monitoring cannot continue until budget is available.",
  waiting_for_fresh_tradable_quote:"Waiting for a fresh exact-token ETH quote. A deployed contract may not yet have a supported liquid market.",
  insufficient_liquidity:"Quoted liquidity is below $1,000. Waiting within the launch entry window.",
  price_above_approved_limit:"The modeled per-token price exceeds your ceiling. No buy unless it falls within the entry window.",
  token_already_bought:"This token is already held or was bought by a snipe. A duplicate buy was blocked.",
  paper_fill_recorded:"One simulated buy was recorded. Open /positions for the holding and /history for the fill.",
  owner_cancelled:"You cancelled this plan. Its paper funds are released.",
  enable_chain_collection_before_route_check:"Send /chainon if you want to enable paid chain checks, then tap Test buy + sell. This does not arm the plan.",
  route_requires_open_plan:"Open or create a draft/armed plan in /snipes before requesting a route test.",
  route_checks_busy:"Three route tests were requested recently. Wait five minutes before requesting another.",
};
function explain(reason: string) {
  return reasons[reason] ?? (reason.startsWith("identity_") ? "Identity checks have not passed. Open Identity review for missing, stale or conflicting evidence." : clean(reason.replaceAll("_"," ")));
}
export function formatSnipe(p: SnipePlan): BotCard {
  const t = p.terms;
  return {text:[`PAPER SNIPE · @${clean(t.projectHandle)}`,`Status: ${clean(p.status.toUpperCase())}`,`Next: ${explain(p.reason)}`,
    `Network: Robinhood MAINNET 4663 · simulated only`, `Project domain: ${clean(t.domain)}`, `Expected deployer: ${clean(t.deployerAddress)}`,
    `Reserve / spend once: ${t.spendEth} ETH`, `Maximum modeled price: ${t.maxUnitPriceEth} ETH/token`, `Minimum quoted liquidity: $${t.minLiquidityUsd}`,
    p.expiresAt ? `Expires: ${p.expiresAt}` : `Valid for ${t.hours}h after arming; confirm this draft within 10 minutes.`,
    ...(p.tokenAddress ? [`Mainnet CA: ${p.tokenAddress}`] : ["CA: wait for independently verified mainnet deployment"]),
    ...routeSummary(p),
    "\nArming reserves paper funds and authorizes ONE automatic paper buy after every gate passes. Launch must occur after arming; entry window is 10 minutes after deployment.",
    "Pons V2 checks: ~10s for the first 10 minutes, then ~5 minutes until expiry. Due deployers share requests. Backlogs, outages and the shared RPC cap can delay detection. No first-block guarantee.",
    "Requires fresh owner-reviewed identity and market data. Quote/model only: 0.3% fee + 0.5% slippage; gas, taxes and sellability are not simulated. No automated exits or real transaction.",
    "\n/stop, /chainoff and /run cancel armed plans. Resuming collection never re-arms them."].join("\n"), reply_markup:{inline_keyboard:[
      ...(p.status === "draft" ? [[button("Arm paper plan",`snipe:arm:${p.id}`)]] : []),
      ...(["draft","armed"].includes(p.status) ? [[button("Cancel plan",`snipe:cancel:${p.id}`)]] : []),
      ...(["draft","armed"].includes(p.status) ? [[button("Test buy + sell",`snipe:route:${p.id}`)]] : []),
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
      if (!/^0x[0-9a-f]{40}$/i.test(args[3]) || /^0x0{40}$/i.test(args[3])) return {text:"DEPLOYER must be the actual mainnet deployer wallet: 0x plus 40 hexadecimal characters. Replace DEPLOYER_WALLET in the example. If you don't know it yet, use /launch @"+projectHandle+" and review its DD. A token CA or factory address is not a substitute."};
      return formatSnipe(await api.draftSnipe({projectHandle,spendEth:args[1],maxUnitPriceEth:args[2],deployerAddress:args[3],hours:Number(args[4]??24),mode:"paper",chainId:4663,actor}));
    }
    const [,action,id] = input.split(":");
    if (action === "help") return snipeHelp(/^[a-z0-9_]{1,15}$/.test(id??"") ? id : "account");
    if (["arm","cancel","route","show"].includes(action)) {
      if (!/^[a-f0-9-]{36}$/.test(id??"")) return {text:"Use /snipes to open a plan."};
      const p = action === "show" ? (await api.listSnipes()).find(p=>p.id===id) : await api.decideSnipe(id,action as "arm"|"cancel"|"route",actor);
      return p ? formatSnipe(p) : {text:"Plan not found. Use /snipes."};
    }
    const plans = await api.listSnipes();
    return {text:["PAPER SNIPE PLANS",...plans.slice(0,10).map(p=>`@${p.terms.projectHandle} · ${p.status} · ${p.terms.spendEth} ETH`),
      ...(!plans.length ? ["No saved plans yet."] : []),
      "\nUse /snipe for the setup guide, or /snipe @account for that project's example."].join("\n"),reply_markup:{inline_keyboard:[...plans.slice(0,10).map(p=>[button(`@${p.terms.projectHandle} · ${p.status}`,`snipe:show:${p.id}`)]),[button("Setup guide","snipe:help:account")]]}};
  } catch (e) { return {text:`Paper plan not confirmed. ${explain(e instanceof Error ? e.message : "service unavailable")}\n\nUse /snipes to check the saved state. No live transaction was sent.`}; }
}
export function createSnipeAlerts(api: Pick<ApiClient,"listSnipes">,store: AlertStore,send: (card:BotCard)=>Promise<void>) {
  let state=store.load();
  return async () => { let sent=0; for(const p of await api.listSnipes()) {
    if(p.status==="draft"&&!p.routeReport)continue;
    const signature=JSON.stringify([p.status,p.reason,p.tokenAddress,p.fillId,p.routeReport?.observedAt]);
    if(state[p.id]?.signature===signature)continue;
    if(sent++>=5)break;
    await send(formatSnipe(p)); const next={...state,[p.id]:{signature,snapshot:p.createdAt}};store.save(next);state=next;
  }};
}

function routeSummary(p:SnipePlan):string[] {
  const r=p.routeReport;
  if(!r)return [p.routeRequestedAt&&(!p.routeCheckedAt||Date.parse(p.routeRequestedAt)>Date.parse(p.routeCheckedAt))?"\nBuy/sell test: queued. It uses up to 20 RPC requests; /stop pauses collection.":"\nTest buy + sell checks a reviewed CA on a native-ETH Pons V2 curve. Up to 20 RPC requests; no funds spent or plan armed.","Diagnostic only: it does not control the plan's automatic paper entry."];
  const expired=!r.expiresAt||Date.now()>Date.parse(r.expiresAt);
  if(r.status!=="passed")return [`\nBuy/sell test: ${clean(r.status)} — ${clean(r.reason.replaceAll("_"," "))}.`,"Review Identity if stale. Other venues, changed bytecode and graduated pools need a separate adapter; a failed test is not proof of a scam.","Diagnostic only: it does not block the existing paper model. Cancel an armed plan if you do not want it to paper-buy."];
  return [`\nBuy/sell test: ${expired?"historical result — refresh before relying on it":"simulated successfully"} · block ${r.blockNumber}`,
    `Buy: ${r.spendEth} ETH → ${r.quantity} tokens`,
    `Buy fees (incl. launch tax): ${r.buyFeeEth} ETH · creator tax: ${r.creatorTaxEth} ETH`,
    `Immediate simulated sell: ${r.sellReturnEth} ETH · round-trip loss before gas: ${r.roundTripLossEth} ETH`,
    `Estimated execution gas: ${r.executionGasEstimateEth} ETH (excludes L1 data fees).`,
    "Tests: once per plan every five minutes. Hypothetical wallet, same simulated block. No future exit guarantee. This test does not change existing paper fills, control automatic paper entry or authorize a live buy."];
}
