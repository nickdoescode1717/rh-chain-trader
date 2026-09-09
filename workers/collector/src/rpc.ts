/**
 * RPC client stub for Robinhood Chain (4663).
 * No-ops when RPC_URL is unset. Never signs or submits txs.
 */
import { CHAIN_ID, BLOCKSCOUT_BASE } from "@rh/core";

export interface RpcClient {
  configured: boolean;
  chainId: number;
  getBlockNumber(): Promise<number | null>;
  getLogs(_filter: Record<string, unknown>): Promise<unknown[]>;
}

export function createRpcClient(rpcUrl?: string): RpcClient {
  const url = rpcUrl ?? process.env.RPC_URL ?? "";
  const configured = Boolean(url);

  return {
    configured,
    chainId: Number(process.env.CHAIN_ID ?? CHAIN_ID),

    async getBlockNumber() {
      if (!configured) {
        console.log("[rpc] no-op getBlockNumber (RPC_URL unset)");
        return null;
      }
      // Minimal eth_blockNumber — read-only
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
      });
      const json = (await res.json()) as { result?: string };
      return json.result ? parseInt(json.result, 16) : null;
    },

    async getLogs(_filter) {
      if (!configured) {
        console.log("[rpc] no-op getLogs (RPC_URL unset)");
        return [];
      }
      // Stub: would call eth_getLogs — Phase 1 leaves empty
      console.log("[rpc] getLogs stub — returning []");
      return [];
    },
  };
}

export function blockscoutTokenUrl(address: string): string {
  return `${process.env.BLOCKSCOUT_BASE_URL ?? BLOCKSCOUT_BASE}/token/${address}`;
}
