/**
 * Verified on-chain contract addresses for Robinhood Chain (chain ID 4663).
 * Confirmed via eth_getCode non-empty on public RPC.
 *
 * Paper/research use only — never used for signing or tx submission.
 */

/** Uniswap v4 PoolManager — official Uniswap deployments */
export const UNISWAP_V4_POOL_MANAGER =
  "0x8366a39cc670b4001a1121b8f6a443a643e40951" as const;

/**
 * Pons V2 LaunchFactory
 * Sources: Bitquery indexers + ponsfamily GitHub
 */
export const PONS_V2_LAUNCH_FACTORY =
  "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;

/** Pons V1 LaunchFactory (legacy) */
export const PONS_V1_LAUNCH_FACTORY =
  "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB" as const;

/** pools.trade entry contract (current) */
export const POOLS_TRADE_ENTRY_CURRENT =
  "0x0000ffffbe8efe702c8703ae3477ff5de3d319c0" as const;

/** pools.trade entry contract (original / historical) */
export const POOLS_TRADE_ENTRY_ORIGINAL =
  "0x00004c4ccc709ef590f7c81102c0689f0263d4e9" as const;

export const VERIFIED_FACTORIES = {
  uniswap: {
    slug: "uniswap" as const,
    address: UNISWAP_V4_POOL_MANAGER,
    label: "Uniswap v4 PoolManager",
    source: "official Uniswap deployments",
  },
  pons: {
    slug: "pons" as const,
    address: PONS_V2_LAUNCH_FACTORY,
    label: "Pons V2 LaunchFactory",
    source: "Bitquery + ponsfamily GitHub",
  },
  "pools-trade": {
    slug: "pools-trade" as const,
    address: POOLS_TRADE_ENTRY_CURRENT,
    label: "pools.trade entry (current)",
    source: "on-chain entry point",
  },
} as const;

/** Contracts we poll for launch events (read-only eth_getLogs). */
export const LAUNCH_POLL_ADDRESSES = [
  PONS_V2_LAUNCH_FACTORY,
  POOLS_TRADE_ENTRY_CURRENT,
  POOLS_TRADE_ENTRY_ORIGINAL,
] as const;
