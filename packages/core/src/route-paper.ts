import { createHash } from "node:crypto";
import { decimal, units, SCALE } from "./paper-execution.js";
import { snipeReservation, type SnipeTerms } from "./snipe.js";
import type { RouteReport } from "./route.js";

/** Binds a collector result to the immutable plan and the exact reviewed deployment. */
export function routeBinding(id: string, t: SnipeTerms, c: {
  id: string; sourceUrl: string; reviewedSourceHash: string | null; reviewedAt: Date | null;
  creationTxHash: string; report: unknown;
}) {
  const chain = (c.report as {chain?:{blockNumber?:string;blockHash?:string;blockTimestamp?:number}} | null)?.chain;
  return createHash("sha256").update(JSON.stringify([id, t.version, t.mode, t.chainId, t.projectHandle,
    t.domain, t.deployerAddress, t.spendEth, t.maxUnitPriceEth, t.hours,
    t.maxLaunchAgeSeconds, t.slippageBps, t.version === 2 ? [t.executionPolicy,t.gasAllowanceEth] : t.feeBps,
    t.version === 2 ? t.maxRoundTripLossBps : t.minLiquidityUsd,
    c.id,c.sourceUrl,c.reviewedSourceHash,c.reviewedAt?.toISOString(),c.creationTxHash,chain?.blockNumber,chain?.blockHash,chain?.blockTimestamp])).digest("hex");
}

/** Route output is hypothetical. Charge the ENTIRE approved gas allowance, not a fabricated actual gas fee. */
export function routePaperBuy(t: SnipeTerms, r: RouteReport | null, context: {
  token: string; binding: string; requestedAt: Date | null; armedAt: Date; born: number; deploymentBlock?:string;
}, now = Date.now()) {
  const fail = (reason: string): never => { throw Error(reason); };
  if (t.version !== 2) fail("unsupported_paper_policy");
  const policy=t as Extract<SnipeTerms,{version:2}>;
  if (policy.executionPolicy !== "pons-route-paper-v1") fail("unsupported_paper_policy");
  if (!r || r.status !== "passed") fail("route_simulation_required");
  const report = r!;
  if (report.version !== 1 || report.venue !== "pons-v2-native-curve" || report.chainId !== 4663 ||
      report.tokenAddress !== context.token || report.deployerAddress !== t.deployerAddress ||
      report.budgetEth !== t.spendEth || report.maxUnitPriceEth !== t.maxUnitPriceEth ||
      report.binding !== context.binding || report.requestedAt !== context.requestedAt?.toISOString()) fail("route_binding_mismatch");
  const observed = Date.parse(report.observedAt), expires = Date.parse(report.expiresAt ?? ""), block = (report.blockTimestamp ?? 0) * 1000;
  if (![observed, expires, block].every(Number.isFinite) || !block || !context.requestedAt ||
      context.requestedAt.getTime() < context.armedAt.getTime() || observed < context.requestedAt.getTime() || observed > now ||
      now >= expires || expires > block + 60_000 || now - observed > 60_000 || block > now + 5000 ||
      block < context.born * 1000 || !Number.isSafeInteger(report.blockNumber) ||
      !/^0x[0-9a-f]{64}$/.test(report.blockHash ?? "")) fail("route_simulation_stale");
  if(context.deploymentBlock!=null&&(!/^\d+$/.test(context.deploymentBlock)||BigInt(report.blockNumber!)<BigInt(context.deploymentBlock)))fail("route_precedes_deployment");
  const amount = (v: unknown) => {
    if (typeof v !== "string" || !/^\d{1,60}(?:\.\d{1,18})?$/.test(v)) fail("route_amount_invalid");
    return units(v as string);
  };
  const spend = amount(report.spendEth), quantity = amount(report.quantity), fee = amount(report.buyFeeEth), tax = amount(report.creatorTaxEth);
  const gas = amount(report.buyGasEstimateEth), allowance = units(policy.gasAllowanceEth);
  const net = amount(report.sellReturnEth), loss = amount(report.roundTripLossEth);
  if (spend !== units(t.spendEth) || quantity <= 0n || fee + tax >= spend || net <= 0n || net > spend || loss !== spend - net || gas <= 0n) fail("route_amount_invalid");
  if(loss*10000n>spend*BigInt(policy.maxRoundTripLossBps))fail("route_round_trip_loss_above_limit");
  if (gas > allowance) fail("route_gas_above_allowance");
  const price = (spend * SCALE + quantity - 1n) / quantity;
  if (price > units(t.maxUnitPriceEth)) fail("price_above_approved_limit");
  const cost = snipeReservation(t);
  return { mode: "paper" as const, side: "buy" as const,
    model: { version: "pons-route-paper-v1", taxesIncluded: true, gasIncluded: true, gasAccounting: "full_approved_allowance", exits: "paper-v1-reference" },
    quantity: decimal(quantity), referencePrice: decimal(price), executionPrice: decimal(price), fee: decimal(fee + tax),
    gasAllowance: decimal(allowance), buyGasEstimate: decimal(gas), cost: decimal(cost), cashDelta: decimal(-cost), realizedPnl: "0", route: report };
}
