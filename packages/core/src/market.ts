export const QUOTE_MAX_AGE_MS = 180_000;
export const ENTRY_MAX_AGE_MS = 90_000;
export const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
export type MarketQuote = {
  [key: string]: unknown;
  chainId: 4663; tokenAddress: string; source: "dexscreener"; pairId: string;
  quoteAddress: string; priceEth: number; priceUsd: number; liquidityUsd: number;
  observedAt: string; sourceUpdatedAt: null; url: string;
};
export type EntrySnapshot = {
  [key: string]: unknown;
  quote: MarketQuote; currency: "ETH" | "USD"; unitPrice: number; cost: number; quantity: number; capturedAt: string;
};
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const positive = (v: unknown): number | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null;
};
export function quoteUsable(q: MarketQuote | null | undefined, token: string, now = Date.now(), maxAge = QUOTE_MAX_AGE_MS): boolean {
  if (!q || q.chainId !== 4663 || q.source !== "dexscreener" || q.tokenAddress !== token.toLowerCase() || q.quoteAddress !== NATIVE_ETH_ADDRESS) return false;
  const age = now - Date.parse(q.observedAt);
  return age >= 0 && age <= maxAge && positive(q.priceEth) != null && positive(q.priceUsd) != null;
}
/** Use the exact base token on RH, priced against native ETH; pool IDs can be 32-byte Uniswap v4 IDs. */
export function selectMarketQuote(raw: unknown, tokenAddress: string, now = new Date()): MarketQuote {
  const token = tokenAddress.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(token) || token === NATIVE_ETH_ADDRESS) throw new Error("invalid_token_address");
  if (!Array.isArray(raw)) throw new Error("invalid_provider_response");
  const candidates: MarketQuote[] = [];
  for (const value of raw.slice(0, 500)) {
    const p = record(value), base = record(p.baseToken), quote = record(p.quoteToken), liq = record(p.liquidity), hour = record(record(p.txns).h1);
    if (p.chainId !== "robinhood" || String(base.address).toLowerCase() !== token || String(quote.address).toLowerCase() !== NATIVE_ETH_ADDRESS) continue;
    if (typeof p.pairAddress !== "string" || !/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(p.pairAddress)) continue;
    const priceEth = positive(p.priceNative), priceUsd = positive(p.priceUsd), liquidityUsd = positive(liq.usd);
    if (priceEth == null || priceUsd == null || liquidityUsd == null || liquidityUsd < 1000 || positive(liq.base) == null || positive(liq.quote) == null) continue;
    if ((positive(hour.buys) ?? 0) + (positive(hour.sells) ?? 0) < 1) continue;
    const pairId = p.pairAddress.toLowerCase();
    candidates.push({ chainId: 4663, tokenAddress: token, source: "dexscreener", pairId, quoteAddress: NATIVE_ETH_ADDRESS,
      priceEth, priceUsd, liquidityUsd, observedAt: now.toISOString(), sourceUpdatedAt: null, url: `https://dexscreener.com/robinhood/${pairId}` });
  }
  candidates.sort((a, b) => b.liquidityUsd - a.liquidityUsd || a.pairId.localeCompare(b.pairId));
  const best = candidates[0];
  if (!best) throw new Error("no_eligible_eth_pool");
  if (candidates.some((q) => q.liquidityUsd >= best.liquidityUsd / 4 && (Math.abs(q.priceEth / best.priceEth - 1) > 0.25 || Math.abs(q.priceUsd / best.priceUsd - 1) > 0.25))) throw new Error("conflicting_pool_prices");
  return best;
}
export async function fetchMarketQuote(token: string, fetcher = fetch): Promise<MarketQuote> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) throw new Error("invalid_token_address");
  const response = await fetcher(`https://api.dexscreener.com/token-pairs/v1/robinhood/${token.toLowerCase()}`, {
    signal: AbortSignal.timeout(8000), redirect: "error", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(response.status === 429 ? "provider_rate_limited" : "provider_unavailable");
  if (!response.body) throw new Error("invalid_provider_response");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length;
      if (bytes > 1_000_000) throw new Error("provider_response_too_large"); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  const body = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return selectMarketQuote(JSON.parse(new TextDecoder().decode(body)), token);
}
export function captureEntry(q: MarketQuote | null, token: string, size: string | null, now = new Date()): EntrySnapshot {
  if (!quoteUsable(q, token, now.getTime(), ENTRY_MAX_AGE_MS)) throw new Error("fresh_entry_quote_required");
  const match = /^(eth|usd):(.+)$/.exec(size ?? ""), cost = positive(match?.[2]);
  if (!match || cost == null) throw new Error("invalid_size");
  const currency = match[1] === "eth" ? "ETH" : "USD", unitPrice = currency === "ETH" ? q!.priceEth : q!.priceUsd;
  const quantity = cost / unitPrice;
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid_quantity");
  return { quote: q!, currency, unitPrice, cost, quantity, capturedAt: now.toISOString() };
}
export function marketPnl(entry: EntrySnapshot, quote: MarketQuote | null | undefined, error: string | null | undefined, now = Date.now()) {
  if (error || !quoteUsable(quote, entry.quote.tokenAddress, now)) return null;
  if ((entry.currency !== "ETH" && entry.currency !== "USD") || positive(entry.quantity) == null || positive(entry.cost) == null || positive(entry.unitPrice) == null) return null;
  const price = entry.currency === "ETH" ? quote!.priceEth : quote!.priceUsd;
  const value = entry.quantity * price, pnl = value - entry.cost, percent = pnl / entry.cost * 100;
  if (![value, pnl, percent].every(Number.isFinite)) return null;
  return { price, value, pnl, percent, currency: entry.currency };
}
