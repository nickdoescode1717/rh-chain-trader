/**
 * Read-only RPC client for Robinhood Chain (4663).
 * Supports eth_blockNumber, eth_getLogs (with batch windows), eth_call.
 * Never signs or submits transactions.
 */
import { CHAIN_ID, BLOCKSCOUT_BASE } from "@rh/core";

export interface LogFilter {
  fromBlock: number | string;
  toBlock: number | string;
  address?: string | string[];
  topics?: (string | null | string[])[];
}

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  removed?: boolean;
}

export interface RpcClient {
  configured: boolean;
  chainId: number;
  getBlockNumber(): Promise<number | null>;
  getLogs(filter: LogFilter): Promise<RpcLog[]>;
  /** Fetch logs across [fromBlock, toBlock] inclusive, splitting on RPC range limits. */
  getLogsBatched(
    filter: Omit<LogFilter, "fromBlock" | "toBlock"> & {
      fromBlock: number;
      toBlock: number;
    },
    windowSize?: number
  ): Promise<RpcLog[]>;
  call(to: string, data: string): Promise<string | null>;
}

function toHexBlock(n: number | string): string {
  if (typeof n === "string") {
    if (n.startsWith("0x") || n === "latest" || n === "earliest" || n === "pending") {
      return n;
    }
    return "0x" + BigInt(n).toString(16);
  }
  return "0x" + n.toString(16);
}

function isRangeTooLarge(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("block range") ||
    m.includes("query returned more than") ||
    m.includes("response size") ||
    m.includes("exceed") ||
    m.includes("too many") ||
    m.includes("limit exceeded") ||
    m.includes("range is too large")
  );
}

export function createRpcClient(rpcUrl?: string): RpcClient {
  const url = rpcUrl ?? process.env.RPC_URL ?? "";
  const configured = Boolean(url);
  let nextId = 1;

  async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const id = nextId++;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    if (!res.ok) {
      throw new Error(`RPC HTTP ${res.status} for ${method}`);
    }
    const json = (await res.json()) as {
      result?: T;
      error?: { code?: number; message?: string };
    };
    if (json.error) {
      const err = new Error(json.error.message ?? "RPC error");
      (err as Error & { code?: number }).code = json.error.code;
      throw err;
    }
    return json.result as T;
  }

  async function getLogsOnce(filter: LogFilter): Promise<RpcLog[]> {
    const params: Record<string, unknown> = {
      fromBlock: toHexBlock(filter.fromBlock),
      toBlock: toHexBlock(filter.toBlock),
    };
    if (filter.address !== undefined) params.address = filter.address;
    if (filter.topics !== undefined) params.topics = filter.topics;
    const result = await rpcCall<RpcLog[]>("eth_getLogs", [params]);
    return Array.isArray(result) ? result : [];
  }

  return {
    configured,
    chainId: Number(process.env.CHAIN_ID ?? CHAIN_ID),

    async getBlockNumber() {
      if (!configured) {
        console.log("[rpc] no-op getBlockNumber (RPC_URL unset)");
        return null;
      }
      const result = await rpcCall<string>("eth_blockNumber", []);
      return result ? parseInt(result, 16) : null;
    },

    async getLogs(filter) {
      if (!configured) {
        console.log("[rpc] no-op getLogs (RPC_URL unset)");
        return [];
      }
      return getLogsOnce(filter);
    },

    async getLogsBatched(filter, windowSize) {
      if (!configured) {
        console.log("[rpc] no-op getLogsBatched (RPC_URL unset)");
        return [];
      }
      const defaultWindow = Number(process.env.LOG_BLOCK_WINDOW ?? 2_000);
      let window = Math.max(1, windowSize ?? defaultWindow);
      const { fromBlock, toBlock, ...rest } = filter;
      if (fromBlock > toBlock) return [];

      const all: RpcLog[] = [];
      let start = fromBlock;

      while (start <= toBlock) {
        const end = Math.min(start + window - 1, toBlock);
        try {
          const logs = await getLogsOnce({
            ...rest,
            fromBlock: start,
            toBlock: end,
          });
          all.push(...logs);
          start = end + 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (isRangeTooLarge(msg) && end > start) {
            const half = Math.max(1, Math.floor((end - start + 1) / 2));
            console.warn(
              `[rpc] eth_getLogs range ${start}-${end} too large (${msg}); splitting to ~${half}`
            );
            window = half;
            continue;
          }
          throw err;
        }
      }
      return all;
    },

    async call(to, data) {
      if (!configured) {
        console.log("[rpc] no-op eth_call (RPC_URL unset)");
        return null;
      }
      const result = await rpcCall<string>("eth_call", [
        { to, data },
        "latest",
      ]);
      return result ?? null;
    },
  };
}

export function blockscoutTokenUrl(address: string): string {
  return `${process.env.BLOCKSCOUT_BASE_URL ?? BLOCKSCOUT_BASE}/token/${address}`;
}

export function blockscoutTxUrl(txHash: string): string {
  return `${process.env.BLOCKSCOUT_BASE_URL ?? BLOCKSCOUT_BASE}/tx/${txHash}`;
}
