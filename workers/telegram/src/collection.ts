import type {ApiClient,CollectionState} from "./api.js";
import type {BotCard} from "./research.js";
export function formatCollection(s:CollectionState):BotCard {
  return {text:["DATA COLLECTION",s.paused ? "STOPPED — research, X and chain collection paused." : "Research collection: enabled",
    `Alchemy / chain monitoring: ${!s.paused && s.chainEnabled ? "enabled" : "OFF"}`,
    `RPC attempts today (UTC): ${s.rpcRequestsToday}/${s.rpcDailyRequestLimit}`,
    "Request counts are not Alchemy compute units or billing totals.",
    ...s.methods.slice(0,5).map(m=>`${m.method}: ${m.attempts}`),
    ...(s.rpcBlockedUntil && Date.parse(s.rpcBlockedUntil)>Date.now() ? [`Provider cooldown until ${s.rpcBlockedUntil}`] : []),
    "\n/stop — pause all collection\n/run — resume research\n/chainon — enable chain-wide launch, wallet and price monitoring\n/chainoff — turn chain monitoring off\n/status — current state\n/usage — X budget",
    "\nStop persists across restarts. In-flight requests may finish or be aborted within a few seconds; already billed work cannot be undone. Telegram and saved holdings remain available.",
  ].join("\n"),reply_markup:{inline_keyboard:[[{text:"Stop collection",callback_data:"collection:stop"},{text:"Resume research",callback_data:"collection:run"}],
    [{text:s.chainEnabled?"Chain OFF":"Enable chain (RPC)",callback_data:s.chainEnabled?"collection:chainoff":"collection:chainon"},{text:"Refresh status",callback_data:"collection:status"}]]}};
}
export async function handleCollectionInput(api:Pick<ApiClient,"getCollection"|"setCollection">,input:string,actor:string):Promise<BotCard|null>{
  const command=input.trim().toLowerCase();
  const action=command.startsWith("collection:")?command.slice(11):command.replace(/^\//,"").split("@")[0];
  if(!["stop","run","chainon","chainoff","status"].includes(action))return null;
  try{return formatCollection(action==="status"?await api.getCollection():await api.setCollection(action,actor));}
  catch{return {text:"Could not confirm collection status. The command has not been confirmed; retry /status or /stop."};}
}
