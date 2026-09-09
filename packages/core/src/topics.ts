/**
 * Event topic0 hashes for launch ingest on Robinhood Chain (4663).
 * Always include 0x prefix for eth_getLogs filters.
 */

/**
 * Pons V2 TokenLaunched
 * indexed: token, curve, deployer — topics[1..3] are 32-byte padded addresses
 */
export const PONS_V2_TOKEN_LAUNCHED =
  "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607" as const;

/**
 * pools.trade TokenCreated(address)
 * Token address is often in `data` (ABI-encoded address); sometimes topic[1].
 * Decode carefully: prefer data word, fall back to topics[1].
 */
export const POOLS_TRADE_TOKEN_CREATED =
  "0x2e2b3f61b70d2d131b2a807371103cc98d51adcaa5e9a8f9c32658ad8426e74e" as const;

export const LAUNCH_TOPICS = {
  ponsV2TokenLaunched: PONS_V2_TOKEN_LAUNCHED,
  poolsTradeTokenCreated: POOLS_TRADE_TOKEN_CREATED,
} as const;
