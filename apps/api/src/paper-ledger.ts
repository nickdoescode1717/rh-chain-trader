import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { auditLog, marketQuotes, paperAccounts, paperFills, paperLedger, paperSellIntents, paperSnipes, positions, purchaseProposals, tokens, type Db } from "@rh/db";
import { captureEntry, decimal, PAPER_MODEL, quoteUsable, routePaperSell, simulateBuy, simulateSell, snipeReservation, units, type routePaperBuy, type EntrySnapshot, type MarketQuote, type RouteSellReport } from "@rh/core";
import { getDb } from "./db.js";
import { dbRowToMem, toPositionPayload } from "./paper-positions-mem.js";
import { identityEnabled, proposalIdentity } from "./identity.js";
export const ledgerEnabled = () => process.env.PAPER_LEDGER_ENABLED === "true";
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export class LedgerError extends Error { constructor(message: string, readonly status: 400 | 404 | 409 | 503 = 409) { super(message); } }
const currencySize = (size: string | null) => {
  const match = /^(eth|usd):(.+)$/.exec(size ?? "");
  if (!match || units(match[2]) <= 0n) throw new LedgerError("invalid_size", 400);
  return { currency: match[1].toUpperCase(), cost: decimal(units(match[2])) };
};
async function initialize(tx: Tx) {
  if ((await tx.select().from(paperAccounts)).length) return;
  const open = await tx.select().from(positions).where(inArray(positions.status, ["simulated_open", "alert_fired"]));
  for (const p of open) currencySize(p.size); // Unknown costs must be reconciled, never silently omitted.
  for (const currency of ["ETH", "USD"]) {
    const initial = units(process.env[currency === "ETH" ? "PAPER_CASH_ETH" : "PAPER_CASH_USD"] || (currency === "ETH" ? "1" : "0"));
    const adopted = open.filter((p) => p.size?.startsWith(currency.toLowerCase() + ":"));
    const spent = adopted.reduce((sum, p) => sum + units(currencySize(p.size).cost), 0n);
    if (initial < 0n || spent > initial) throw new LedgerError("legacy_balance_requires_reconciliation");
    await tx.insert(paperAccounts).values({ currency, cash: decimal(initial - spent) });
    await tx.insert(paperLedger).values({ eventKey: `initial:${currency}`, currency, kind: "initial_paper_capital", delta: decimal(initial) });
    for (const p of adopted) {
      const snapshot = p.entrySnapshot as EntrySnapshot | null, cost = currencySize(p.size).cost;
      const quantity = snapshot && snapshot.currency === currency && snapshot.quantity > 0 ? decimal(units(snapshot.quantity)) : null;
      await tx.update(positions).set({ ledgerManaged: true, remainingCost: cost, remainingQuantity: quantity }).where(eq(positions.id, p.id));
      await tx.insert(paperLedger).values({ eventKey: `adopt:${p.id}`, currency, positionId: p.id, kind: "legacy_cost_adoption", delta: decimal(-units(cost)) });
    }
  }
}
export async function withLedger<T>(action: (tx: Tx) => Promise<T>): Promise<T> {
  const db = getDb(); if (!db) throw new LedgerError("paper_storage_unavailable", 503);
  return db.transaction(async (tx) => {
    // One book, low volume: serialize settlement and bootstrap across processes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4663, 9009)`);
    await initialize(tx);
    await reconcile(tx);
    return action(tx);
  });
}
async function currentQuote(tx: Tx, address: string | null) {
  const [cached] = await tx.select().from(marketQuotes).where(eq(marketQuotes.tokenAddress, (address ?? "").toLowerCase()));
  const q = cached?.quote as MarketQuote | null;
  if (!cached || cached.lastError || !quoteUsable(q, address ?? "", Date.now(), 90_000)) throw new LedgerError("fresh_entry_quote_required");
  return q!;
}
export async function ledgerBuy(id: string, actor: string) {
  return withLedger(tx => settleLedgerBuy(tx, id, actor));
}
export async function reservedSnipeEth(tx: Tx, excluding?: string) {
  const plans = await tx.select().from(paperSnipes).where(and(eq(paperSnipes.status, "armed"), sql`${paperSnipes.expiresAt} > now()`));
  return plans.filter(p => p.id !== excluding).reduce((sum, p) => sum + snipeReservation(p.terms), 0n);
}
/** Internal atomic settlement primitive. Automatic callers must validate the immutable plan in this same transaction. */
export async function settleLedgerBuy(tx: Tx, id: string, actor: string, snipeId?: string, routeExecution?: ReturnType<typeof routePaperBuy>) {
    const [proposal] = await tx.select().from(purchaseProposals).where(eq(purchaseProposals.id, id)).for("update");
    if (!proposal) throw new LedgerError("not_found", 404);
    const [prior] = await tx.select().from(paperFills).where(eq(paperFills.eventKey, `buy:${id}`));
    if (prior) {
      const [position] = await tx.select().from(positions).where(eq(positions.id, prior.positionId));
      return { proposal, position, fill: prior, replayed: true };
    }
    if (proposal.status !== (snipeId ? "pending_snipe" : "pending_nick") || (proposal.expiresAt && proposal.expiresAt.getTime() <= Date.now())) throw new LedgerError("not_pending_or_expired");
    const identity = identityEnabled() ? await proposalIdentity(tx, proposal) : null;
    if (identity && identity.status !== "verified") throw new LedgerError(`identity_${identity.status}:${identity.reasons.join(",")}`);
    const { currency, cost: spend } = currencySize(proposal.size);
    if(routeExecution&&(!snipeId||currency!=="ETH"||routeExecution.route.tokenAddress!==proposal.tokenAddress||routeExecution.route.spendEth!==spend))throw new LedgerError("route_settlement_mismatch");
    const q=routeExecution?null:await currentQuote(tx,proposal.tokenAddress);
    const model = routeExecution ?? simulateBuy(spend, String(currency === "ETH" ? q!.priceEth : q!.priceUsd));
    const cost=model.cost;
    const [account] = await tx.select().from(paperAccounts).where(eq(paperAccounts.currency, currency));
    const reserved = currency === "ETH" ? await reservedSnipeEth(tx, snipeId) : 0n;
    if (units(account.cash) - reserved < units(cost)) throw new LedgerError("insufficient_paper_cash");
    const snapshot:EntrySnapshot=routeExecution?{quote:{chainId:4663,tokenAddress:proposal.tokenAddress!,source:"pons-route-simulation",venue:routeExecution.route.venue,
      observedAt:routeExecution.route.observedAt,blockNumber:routeExecution.route.blockNumber!,blockHash:routeExecution.route.blockHash!},currency:"ETH",
      unitPrice:Number(model.executionPrice),cost:Number(cost),quantity:Number(model.quantity),capturedAt:routeExecution.route.observedAt}:captureEntry(q, proposal.tokenAddress!, proposal.size);
    snapshot.identity = identity;
    // Immutable execution snapshot contains modeled costs as well as reference quote.
    snapshot.unitPrice = Number(model.executionPrice); snapshot.quantity = Number(model.quantity); snapshot.cost=Number(cost); snapshot.execution = model;
    const [position] = await tx.insert(positions).values({ tokenAddress: proposal.tokenAddress, size: proposal.size,
      entryPrice: model.executionPrice, currentPrice: q?String(currency === "ETH" ? q.priceEth : q.priceUsd):null, entrySnapshot: snapshot,
      markSource: routeExecution?"pons_route":"dexscreener", markObservedAt: q?new Date(q.observedAt):null, openedAt: new Date(), status: "simulated_open",
      proposalId: id, channel: "telegram", note: routeExecution ? "Paper route quantity/fees; full approved entry gas allowance charged; supported Pons exits require fresh reserve quotes; no live transaction" : "Paper fill; explicit modeled fee/slippage; no live transaction",
      ledgerManaged: true, remainingQuantity: model.quantity, remainingCost: cost }).returning();
    const [fill] = await tx.insert(paperFills).values({ eventKey: `buy:${id}`, positionId: position.id, currency, side: "buy", execution: { ...model, identity }, quote: snapshot.quote, actor }).returning();
    await tx.update(paperAccounts).set({ cash: decimal(units(account.cash) - units(cost)) }).where(eq(paperAccounts.currency, currency));
    await tx.insert(paperLedger).values({ eventKey: `buy:${id}`, currency, positionId: position.id, kind: "buy", delta: model.cashDelta });
    const [approved] = await tx.update(purchaseProposals).set({ status: "approved", approvedAt: new Date(), note: "PAPER_LEDGER_SETTLED" }).where(eq(purchaseProposals.id, id)).returning();
    await tx.insert(auditLog).values({ action: "paper_buy_settled", actor, detail: { proposalId: id, positionId: position.id, fillId: fill.id, mode: "paper" } });
    return { proposal: approved, position, fill, replayed: false };
}
export async function previewSell(id: string, percent: number, actor: string) {
  if (![25, 50, 100].includes(percent)) throw new LedgerError("invalid_sell_percent", 400);
  return withLedger(async (tx) => {
    const [p] = await tx.select().from(positions).where(eq(positions.id, id));
    if (!p) throw new LedgerError("position_not_found", 404);
    if (!["simulated_open", "alert_fired"].includes(p.status)) throw new LedgerError("position_closed");
    if (!p.entrySnapshot || !p.remainingQuantity || !p.remainingCost) throw new LedgerError("legacy_entry_quantity_missing");
    const { currency } = currencySize(p.size);
    const entry=p.entrySnapshot as (EntrySnapshot&{execution?:{model?:{version?:string};route?:{deployerAddress?:string}}})|null;
    if(entry?.execution?.model?.version==="pons-route-paper-v1"){
      if(currency!=="ETH")throw new LedgerError("route_sell_currency_unsupported");
      const [recent]=await tx.select({n:sql<number>`count(*)::int`}).from(paperSellIntents).where(sql`${paperSellIntents.routeRequestedAt}>now()-interval '5 minutes' and ${paperSellIntents.status}<>'cancelled'`);
      if(Number(recent.n)>=3)throw new LedgerError("route_checks_busy");
      const quantity=decimal(units(p.remainingQuantity)*BigInt(percent)/100n);if(units(quantity)<=0n)throw new LedgerError("amount_below_precision");
      const now=new Date(),placeholder={mode:"paper",side:"sell",quantity,fee:"0",cashDelta:"0",executionPrice:"0",cost:"0",realizedPnl:"0",
        remainingQuantity:p.remainingQuantity,remainingCost:p.remainingCost,model:{version:"pons-route-paper-sell-queued"}};
      const [intent]=await tx.insert(paperSellIntents).values({positionId:id,positionVersion:p.positionVersion,percent,currency,actor,minimumNet:"0.000000000000000001",
        preview:placeholder,status:"route_quoting",expiresAt:new Date(now.getTime()+300_000),routeRequestedAt:now}).returning();
      return {...intent,tokenCA:p.tokenAddress,paperOnly:true,queued:true,phase:"quote"};
    }
    const q = await currentQuote(tx, p.tokenAddress);
    const preview = simulateSell(p.remainingQuantity, p.remainingCost, percent, String(currency === "ETH" ? q.priceEth : q.priceUsd));
    const minimumNet = decimal(units(preview.cashDelta) * BigInt(10000 - PAPER_MODEL.confirmMoveBps) / 10000n);
    const [intent] = await tx.insert(paperSellIntents).values({ positionId: id, positionVersion: p.positionVersion, percent, currency,
      actor, minimumNet, preview, expiresAt: new Date(Date.now() + 90_000) }).returning();
    return { ...intent, tokenCA: p.tokenAddress, paperOnly: true };
  });
}
export async function confirmSell(id: string, actor: string) {
  return withLedger(async (tx) => {
    const [intent] = await tx.select().from(paperSellIntents).where(eq(paperSellIntents.id, id)).for("update");
    if (!intent) throw new LedgerError("sell_intent_not_found", 404);
    if (intent.actor !== actor) throw new LedgerError("sell_owner_mismatch");
    if (intent.status === "executed" && intent.fillId) {
      const [fill] = await tx.select().from(paperFills).where(eq(paperFills.id, intent.fillId)); return { fill, replayed: true };
    }
    if(intent.status==="route_failed")throw new LedgerError((intent.routeReport as RouteSellReport|null)?.reason??"route_sell_quote_failed");
    if(intent.status==="route_quoting"||intent.status==="route_confirming"){
      if(intent.expiresAt.getTime()<=Date.now())throw new LedgerError("sell_preview_expired");
      return {intent,queued:true,phase:intent.status==="route_quoting"?"quote":"execution"};
    }
    if (intent.status !== "pending"&&intent.status!=="execution_ready" || intent.expiresAt.getTime() <= Date.now()) throw new LedgerError("sell_preview_expired");
    const [p] = await tx.select().from(positions).where(eq(positions.id, intent.positionId)).for("update");
    if (!p || p.positionVersion !== intent.positionVersion || !["simulated_open", "alert_fired"].includes(p.status)) throw new LedgerError("position_changed_refresh_preview");
    if (!p.remainingQuantity || !p.remainingCost) throw new LedgerError("legacy_entry_quantity_missing");
    const currency = intent.currency,routePreview=(intent.preview as {model?:{version?:string}})?.model?.version==="pons-route-paper-sell-v1";
    if(routePreview&&intent.status==="pending"){
      const requested=new Date();
      const [queued]=await tx.update(paperSellIntents).set({status:"route_confirming",routeRequestedAt:requested,routeAttemptAt:null,routeCheckedAt:null,routeReport:null,
        expiresAt:new Date(requested.getTime()+300_000)}).where(and(eq(paperSellIntents.id,id),eq(paperSellIntents.status,"pending"))).returning();
      return {intent:queued,queued:true,phase:"execution"};
    }
    let q:Record<string,unknown>,execution:ReturnType<typeof simulateSell>|ReturnType<typeof routePaperSell>;
    if(intent.status==="execution_ready"){
      const entry=p.entrySnapshot as (EntrySnapshot&{execution?:{route?:{deployerAddress?:string}}})|null;
      const deployer=entry?.execution?.route?.deployerAddress?.toLowerCase()??"";
      const token=p.tokenAddress?.toLowerCase()??"";
      try{execution=routePaperSell(p.remainingQuantity,p.remainingCost,intent.percent,intent.routeReport as RouteSellReport|null,
        {token,deployer,requestedAt:intent.routeRequestedAt});}catch(e){throw new LedgerError(e instanceof Error?e.message:"route_sell_quote_invalid");}
      q={tokenAddress:token,source:"pons-v2-exact-reserves",observedAt:(intent.routeReport as RouteSellReport).observedAt,route:intent.routeReport};
    }else{
      const market=await currentQuote(tx,p.tokenAddress);q=market;
      execution=simulateSell(p.remainingQuantity,p.remainingCost,intent.percent,String(currency==="ETH"?market.priceEth:market.priceUsd));
    }
    if (units(execution.cashDelta) < units(intent.minimumNet)) throw new LedgerError("price_moved_refresh_preview");
    const [account] = await tx.select().from(paperAccounts).where(eq(paperAccounts.currency, currency));
    const [fill] = await tx.insert(paperFills).values({ eventKey: `sell:${id}`, positionId: p.id, currency, side: "sell", execution, quote: q, actor }).returning();
    await tx.update(paperAccounts).set({ cash: decimal(units(account.cash) + units(execution.cashDelta)), realizedPnl: decimal(units(account.realizedPnl) + units(execution.realizedPnl)) }).where(eq(paperAccounts.currency, currency));
    await tx.insert(paperLedger).values({ eventKey: `sell:${id}`, currency, positionId: p.id, kind: "sell", delta: execution.cashDelta });
    const closed = units(execution.remainingQuantity) === 0n;
    await tx.update(positions).set({ remainingQuantity: execution.remainingQuantity, remainingCost: execution.remainingCost,
      realizedPnl: decimal(units(p.realizedPnl) + units(execution.realizedPnl)), positionVersion: p.positionVersion + 1,
      status: closed ? "closed" : "simulated_open", closedAt: closed ? new Date() : null }).where(eq(positions.id, p.id));
    await tx.update(paperSellIntents).set({ status: "executed", fillId: fill.id }).where(eq(paperSellIntents.id, id));
    await tx.insert(auditLog).values({ action: "paper_sell_settled", actor, detail: { intentId: id, positionId: p.id, fillId: fill.id, mode: "paper" } });
    return { fill, replayed: false };
  });
}
export async function ledgerSummary() {
  return withLedger(async (tx) => {
    const accounts = await tx.select().from(paperAccounts);
    const movements = await tx.select({ currency: paperLedger.currency, total: sql<string>`sum(${paperLedger.delta})::text` }).from(paperLedger).groupBy(paperLedger.currency);
    const reconciled = accounts.every((a) => units(a.cash) === units(movements.find((m) => m.currency === a.currency)?.total ?? "0"));
    if (!reconciled) throw new LedgerError("ledger_reconciliation_failed", 503);
    return { accounts, reconciled, model: PAPER_MODEL };
  });
}
export async function fillHistory() { return withLedger(tx => tx.select().from(paperFills).orderBy(desc(paperFills.createdAt)).limit(100)); }

export async function sellIntent(id:string,actor:string){
  return withLedger(async tx=>{
    const [row]=await tx.select({intent:paperSellIntents,tokenCA:positions.tokenAddress}).from(paperSellIntents)
      .innerJoin(positions,eq(positions.id,paperSellIntents.positionId)).where(eq(paperSellIntents.id,id));
    if(!row)throw new LedgerError("sell_intent_not_found",404);
    if(row.intent.actor!==actor)throw new LedgerError("sell_owner_mismatch");
    if(row.intent.status==="route_failed")throw new LedgerError((row.intent.routeReport as RouteSellReport|null)?.reason??"route_sell_quote_failed");
    if(row.intent.status==="executed"&&row.intent.fillId){const [fill]=await tx.select().from(paperFills).where(eq(paperFills.id,row.intent.fillId));return {fill,replayed:true};}
    if(row.intent.expiresAt.getTime()<=Date.now())throw new LedgerError("sell_preview_expired");
    return {...row.intent,tokenCA:row.tokenCA,paperOnly:true,queued:["route_quoting","route_confirming","execution_ready"].includes(row.intent.status),
      phase:row.intent.status==="route_quoting"?"quote":row.intent.status==="pending"?"preview":"execution"};
  });
}

async function reconcile(tx: Tx) {
  const accounts = await tx.select().from(paperAccounts);
  const movements = await tx.select({ currency: paperLedger.currency, total: sql<string>`sum(${paperLedger.delta})::text` }).from(paperLedger).groupBy(paperLedger.currency);
  if (accounts.length !== 2 || !accounts.every(a => units(a.cash) === units(movements.find(m => m.currency === a.currency)?.total ?? "0"))) throw new LedgerError("ledger_reconciliation_failed", 503);
  const realized = await tx.select({ currency: paperFills.currency, total: sql<string>`sum((${paperFills.execution}->>'realizedPnl')::numeric)::text` })
    .from(paperFills).groupBy(paperFills.currency);
  if (!accounts.every(a => units(a.realizedPnl) === units(realized.find(r => r.currency === a.currency)?.total ?? "0"))) throw new LedgerError("ledger_reconciliation_failed", 503);
  const corrupted = await tx.execute(sql`
    WITH settled AS (
      SELECT position_id, sum(CASE WHEN side='buy' THEN (execution->>'cost')::numeric ELSE -(execution->>'cost')::numeric END) cost,
        sum(CASE WHEN side='buy' THEN (execution->>'quantity')::numeric ELSE -(execution->>'quantity')::numeric END) quantity,
        sum((execution->>'realizedPnl')::numeric) realized
      FROM paper_fills GROUP BY position_id
    ), adopted AS (
      SELECT position_id, -sum(delta) cost FROM paper_ledger WHERE kind='legacy_cost_adoption' GROUP BY position_id
    ) SELECT p.id FROM positions p LEFT JOIN settled s ON s.position_id=p.id LEFT JOIN adopted a ON a.position_id=p.id
      WHERE p.ledger_managed AND (
        p.remaining_cost IS DISTINCT FROM coalesce(s.cost,0)+coalesce(a.cost,0) OR
        p.realized_pnl IS DISTINCT FROM coalesce(s.realized,0) OR
        (a.position_id IS NULL AND p.remaining_quantity IS NULL) OR
        (p.remaining_quantity IS NOT NULL AND p.remaining_quantity IS DISTINCT FROM
          coalesce(s.quantity,0)+CASE WHEN a.position_id IS NOT NULL THEN trunc(coalesce((p.entry_snapshot->>'quantity')::numeric,0),18) ELSE 0 END)
      ) LIMIT 1`);
  if (corrupted.length) throw new LedgerError("ledger_reconciliation_failed", 503);
}

export async function cancelSell(id: string, actor: string) {
  return withLedger(async tx => {
    const [intent] = await tx.select().from(paperSellIntents).where(eq(paperSellIntents.id, id));
    if (!intent) throw new LedgerError("sell_intent_not_found", 404);
    if (intent.actor !== actor) throw new LedgerError("sell_owner_mismatch");
    if (intent.status === "executed") throw new LedgerError("sell_already_executed");
    await tx.update(paperSellIntents).set({ status: "cancelled" }).where(eq(paperSellIntents.id, id));
    return { cancelled: true };
  });
}

/** Read cash and holdings under the same settlement lock; never fall back to memory. */
export async function ledgerBook() {
  return withLedger(async tx => {
    const accounts = await tx.select().from(paperAccounts);
    const rows = await tx.select({ p: positions, symbol: tokens.symbol, scores: purchaseProposals.scores,
      quote: marketQuotes.quote, error: marketQuotes.lastError }).from(positions)
      .leftJoin(tokens, and(eq(tokens.chainId, 4663), sql`lower(${tokens.address}) = lower(${positions.tokenAddress})`))
      .leftJoin(purchaseProposals, eq(purchaseProposals.id, positions.proposalId))
      .leftJoin(marketQuotes, and(eq(marketQuotes.chainId, 4663), sql`${marketQuotes.tokenAddress} = lower(${positions.tokenAddress})`))
      .orderBy(desc(positions.createdAt));
    const holdings = rows.map(r => {
      const p = dbRowToMem({ ...r.p, symbol: r.symbol || (typeof r.scores?.symbol === "string" ? r.scores.symbol : null) });
      p.marketQuote = r.quote as MarketQuote | null; p.marketError = r.error;
      return toPositionPayload(p);
    });
    const open = holdings.filter(p => ["simulated_open", "alert_fired"].includes(p.status));
    const eth = open.filter(p => p.pnlCurrency === "ETH");
    const cash = accounts.find(a => a.currency === "ETH")!;
    const positionsEth = eth.reduce((sum, p) => sum + (p.currentValue ?? Number(p.remainingCost ?? 0)), 0);
    const reserved = await reservedSnipeEth(tx);
    return { holdings, balance: { paperOnly: true, ledgerReconciled: true, model: PAPER_MODEL, accounts,
      reservedSnipeEth: decimal(reserved), availableCashEth: decimal(units(cash.cash) - reserved),
      cashEth: cash.cash, equityEth: String(Number(cash.cash) + positionsEth), realizedPnlEth: cash.realizedPnl,
      valuationComplete: open.length === eth.length && eth.every(p => p.currentValue != null),
      positions: open.map(p => ({ ...p, mark: p.currentPrice })), buyWallets: [],
      totals: { cashEth: cash.cash, positionsEth: String(positionsEth), unrealizedEth: String(eth.reduce((sum,p) => sum + (p.unrealizedPnl ?? 0),0)), equityEth: String(Number(cash.cash) + positionsEth) },
      note: "Durable paper ledger. Unpriced positions use remaining cost. Route snipes include simulated buy fees/taxes and a fixed entry gas allowance; their Pons curve exits use fresh exact reserves, fees and tax but exclude exit gas. Standard entries/exits use the reference model." } };
  });
}
