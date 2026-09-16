// Paper settlement uses fixed-point decimal arithmetic. A live adapter must supply
// confirmed fills/fees instead of calling this reference-price simulation.
export const SCALE = 10n ** 18n;
export function units(value: string | number): bigint {
  const raw = String(value).trim();
  const m = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
  if (!m || raw.length > 160) throw new Error("invalid_decimal");
  const exponent = Number(m[4] ?? 0), fraction = m[3] ?? "";
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 80) throw new Error("decimal_out_of_range");
  const shift = 18 + exponent - fraction.length, digits = BigInt(m[2] + fraction);
  const result = shift >= 0 ? digits * 10n ** BigInt(shift) : digits / 10n ** BigInt(-shift);
  if (result >= 10n ** 78n) throw new Error("decimal_out_of_range");
  return m[1] === "-" ? -result : result;
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "", n = value < 0n ? -value : value;
  const fraction = (n % SCALE).toString().padStart(18, "0").replace(/0+$/, "");
  return sign + (n / SCALE).toString() + (fraction ? "." + fraction : "");
}
export const PAPER_MODEL = { version: "paper-v1", feeBps: 30, slippageBps: 50, confirmMoveBps: 100, gasIncluded: false, taxesIncluded: false } as const;
export function simulateBuy(budgetText: string, referenceText: string) {
  const budget = units(budgetText), reference = units(referenceText);
  if (budget <= 0n || reference <= 0n) throw new Error("invalid_fill_amount");
  const fee = (budget * BigInt(PAPER_MODEL.feeBps) + 9999n) / 10000n;
  const price = (reference * BigInt(10000 + PAPER_MODEL.slippageBps) + 9999n) / 10000n;
  const quantity = (budget - fee) * SCALE / price;
  if (quantity <= 0n) throw new Error("amount_below_precision");
  return { mode: "paper" as const, model: PAPER_MODEL, side: "buy" as const, quantity: decimal(quantity), referencePrice: decimal(reference),
    executionPrice: decimal(price), fee: decimal(fee), cashDelta: decimal(-budget), cost: decimal(budget), realizedPnl: "0" };
}
export function simulateSell(remainingQuantity: string, remainingCost: string, percent: number, referenceText: string) {
  if (![25, 50, 100].includes(percent)) throw new Error("invalid_sell_percent");
  const remaining = units(remainingQuantity), cost = units(remainingCost), reference = units(referenceText);
  if (remaining <= 0n || cost < 0n || reference <= 0n) throw new Error("invalid_fill_amount");
  const quantity = remaining * BigInt(percent) / 100n;
  if (quantity <= 0n) throw new Error("amount_below_precision");
  const price = reference * BigInt(10000 - PAPER_MODEL.slippageBps) / 10000n;
  const gross = quantity * price / SCALE, fee = (gross * BigInt(PAPER_MODEL.feeBps) + 9999n) / 10000n;
  const net = gross - fee, allocatedCost = quantity === remaining ? cost : cost * quantity / remaining;
  if (net <= 0n) throw new Error("amount_below_precision");
  return { mode: "paper" as const, model: PAPER_MODEL, side: "sell" as const, quantity: decimal(quantity), referencePrice: decimal(reference),
    executionPrice: decimal(price), fee: decimal(fee), cashDelta: decimal(net), cost: decimal(allocatedCost), realizedPnl: decimal(net - allocatedCost),
    remainingQuantity: decimal(remaining - quantity), remainingCost: decimal(cost - allocatedCost) };
}
