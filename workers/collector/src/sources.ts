/**
 * Collector poll sources — addresses + event topics for read-only eth_getLogs.
 * Paper/research only: never used for signing or tx submission.
 *
 * Verified (chain 4663): eth_getCode non-empty on public RPC.
 */
import {
  PONS_V2_LAUNCH_FACTORY,
  POOLS_TRADE_ENTRY_CURRENT,
  POOLS_TRADE_ENTRY_ORIGINAL,
  PONS_V2_TOKEN_LAUNCHED,
  POOLS_TRADE_TOKEN_CREATED,
} from "@rh/core";

export type LaunchSourceKind = "pons-v2" | "pools-trade";

export interface LaunchPollSource {
  /** Stable id for cursor / logs */
  id: string;
  kind: LaunchSourceKind;
  /** protocols.slug row to attach evidence / factory updates */
  protocolSlug: "pons" | "pools-trade";
  address: string;
  topic0: string;
  label: string;
  /** Where the token address lives in the log */
  tokenLocation: "topics1" | "data-or-topics1";
  citations: string[];
}

/**
 * Sources we poll every tick.
 * Pons V1 factory is recorded in migration notes but not polled (V2 topic only).
 */
export const LAUNCH_POLL_SOURCES: readonly LaunchPollSource[] = [
  {
    id: "pons-v2-factory",
    kind: "pons-v2",
    protocolSlug: "pons",
    address: PONS_V2_LAUNCH_FACTORY,
    topic0: PONS_V2_TOKEN_LAUNCHED,
    label: "Pons V2 LaunchFactory TokenLaunched",
    tokenLocation: "topics1",
    citations: [
      "Address: Bitquery indexers + ponsfamily GitHub; eth_getCode non-empty on chain 4663",
      "Topic0 TokenLaunched: 0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607 (indexed: token, curve, deployer)",
    ],
  },
  {
    id: "pools-trade-entry-current",
    kind: "pools-trade",
    protocolSlug: "pools-trade",
    address: POOLS_TRADE_ENTRY_CURRENT,
    topic0: POOLS_TRADE_TOKEN_CREATED,
    label: "pools.trade entry (current) TokenCreated",
    tokenLocation: "data-or-topics1",
    citations: [
      "Address: on-chain entry point 0x0000ffff…; eth_getCode non-empty on chain 4663",
      "Topic0 TokenCreated(address): 0x2e2b3f61b70d2d131b2a807371103cc98d51adcaa5e9a8f9c32658ad8426e74e",
    ],
  },
  {
    id: "pools-trade-entry-original",
    kind: "pools-trade",
    protocolSlug: "pools-trade",
    address: POOLS_TRADE_ENTRY_ORIGINAL,
    topic0: POOLS_TRADE_TOKEN_CREATED,
    label: "pools.trade entry (original) TokenCreated",
    tokenLocation: "data-or-topics1",
    citations: [
      "Address: historical entry 0x00004c4c…; eth_getCode non-empty on chain 4663",
      "Same TokenCreated topic as current entry",
    ],
  },
] as const;

/** Sample eth_getLogs filter (Pons V2) for docs / ops. */
export function sampleLogFilter(fromBlockHex: string, toBlockHex: string) {
  return {
    fromBlock: fromBlockHex,
    toBlock: toBlockHex,
    address: PONS_V2_LAUNCH_FACTORY,
    topics: [PONS_V2_TOKEN_LAUNCHED],
  };
}
