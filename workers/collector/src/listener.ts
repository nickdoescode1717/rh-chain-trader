import {waitForCollection} from "./collection-control.js";
import { recordLaunchDeployment } from "./launch-preparation.js";
/**
 * On-chain launch listener (paper / research only).
 * Polls Pons V2 + pools.trade entries via eth_getLogs, upserts tokens + evidence.
 * Never submits transactions or enables trading.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { eq, and } from "drizzle-orm";
import {
  CHAIN_ID,
  PONS_V2_LAUNCH_FACTORY,
  POOLS_TRADE_ENTRY_CURRENT,
  UNISWAP_V4_POOL_MANAGER,
} from "@rh/core";
import {
  createDb,
  tokens,
  evidence,
  protocols,
  type Db,
} from "@rh/db";
import type { RpcClient, RpcLog } from "./rpc.js";
import { verifyContractPresence } from "./verify-contract.js";
import { blockscoutTokenUrl, blockscoutTxUrl } from "./rpc.js";
import {
  LAUNCH_POLL_SOURCES,
  type LaunchPollSource,
  sampleLogFilter,
} from "./sources.js";
import {
  tokenFromPonsV2Log,
  tokenFromPoolsTradeLog,
  abiDecodeString,
  abiDecodeUint,
  ERC20_SELECTORS,
} from "./decode.js";

interface CursorState {
  lastBlock: number;
  updatedAt: string;
}

function cursorPath(): string {
  return resolve(
    process.env.COLLECTOR_CURSOR_PATH ??
      new URL("../data/launch-cursor.json", import.meta.url).pathname
  );
}

function loadCursor(defaultBlock: number): CursorState {
  const path = cursorPath();
  try {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, "utf8")) as CursorState;
      if (typeof raw.lastBlock === "number" && raw.lastBlock >= 0) {
        return raw;
      }
    }
  } catch (err) {
    console.warn("[collector] cursor read failed, starting fresh", err);
  }
  return { lastBlock: defaultBlock, updatedAt: new Date().toISOString() };
}

function saveCursor(state: CursorState) {
  const path = cursorPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function decodeTokenAddress(source: LaunchPollSource, log: RpcLog): string | null {
  if (source.tokenLocation === "topics1") {
    return tokenFromPonsV2Log(log.topics ?? []);
  }
  return tokenFromPoolsTradeLog(log.topics ?? [], log.data ?? "0x");
}

async function fetchErc20Meta(
  rpc: RpcClient,
  tokenAddress: string
): Promise<{ name: string; symbol: string; decimals: number }> {
  let name = "Unknown";
  let symbol = "???";
  let decimals = 18;
  try {
    const [nameRaw, symbolRaw, decimalsRaw] = await Promise.all([
      rpc.call(tokenAddress, ERC20_SELECTORS.name),
      rpc.call(tokenAddress, ERC20_SELECTORS.symbol),
      rpc.call(tokenAddress, ERC20_SELECTORS.decimals),
    ]);
    name = abiDecodeString(nameRaw) ?? name;
    symbol = abiDecodeString(symbolRaw) ?? symbol;
    decimals = abiDecodeUint(decimalsRaw) ?? decimals;
  } catch (err) {
    console.warn(
      `[collector] erc20 meta failed for ${tokenAddress}:`,
      (err as Error).message
    );
  }
  return { name, symbol, decimals };
}

async function ensureProtocolsVerified(db: Db, rpc: RpcClient) {
  const updates: Array<{ slug: string; factoryAddress: string; notes: string }> = [
    {
      slug: "uniswap",
      factoryAddress: UNISWAP_V4_POOL_MANAGER,
      notes:
        "Uniswap v4 PoolManager on chain 4663. Source: official Uniswap deployments. eth_getCode non-empty. Verified via collector.",
    },
    {
      slug: "pons",
      factoryAddress: PONS_V2_LAUNCH_FACTORY,
      notes:
        "Pons V2 LaunchFactory on chain 4663. Sources: Bitquery + ponsfamily GitHub. eth_getCode non-empty. Verified via collector.",
    },
    {
      slug: "pools-trade",
      factoryAddress: POOLS_TRADE_ENTRY_CURRENT,
      notes:
        "pools.trade entry (current) on chain 4663. eth_getCode non-empty. Verified via collector.",
    },
  ];

  for (const u of updates) {
    const check = await verifyContractPresence(rpc, u.factoryAddress, CHAIN_ID);
    await db
      .update(protocols)
      .set({
        factoryAddress: u.factoryAddress,
        verifiedOnchain: check.present,
        notes: `Collector check ${new Date().toISOString()}: ${check.reason}. Configured registry address; bytecode presence does not establish source verification, protocol identity, or contract safety.`,
      })
      .where(eq(protocols.slug, u.slug));
  }
}

async function upsertLaunch(
  db: Db,
  rpc: RpcClient,
  source: LaunchPollSource,
  log: RpcLog,
  chainId: number
): Promise<boolean> {
  await recordLaunchDeployment(db, log, chainId);
  const tokenAddress = decodeTokenAddress(source, log);
  if (!tokenAddress) {
    console.warn(
      `[collector] could not decode token from ${source.id} tx=${log.transactionHash}`
    );
    return false;
  }

  // Never ingest fictional placeholders
  if (tokenAddress.toLowerCase().includes("fictional")) {
    console.warn(`[collector] skipping fictional-looking address ${tokenAddress}`);
    return false;
  }

  const [known] = await db.select({ name: tokens.name, symbol: tokens.symbol, decimals: tokens.decimals }).from(tokens)
    .where(and(eq(tokens.chainId,chainId),eq(tokens.address,tokenAddress.toLowerCase()))).limit(1);
  const meta = known?.name && known.symbol && known.symbol !== "???" ? { name: known.name, symbol: known.symbol, decimals: known.decimals ?? 18 } : await fetchErc20Meta(rpc, tokenAddress);
  const blockNumber = parseInt(log.blockNumber, 16);
  const txHash = log.transactionHash;

  const [proto] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.slug, source.protocolSlug))
    .limit(1);

  await db
    .insert(tokens)
    .values({
      address: tokenAddress.toLowerCase(),
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      category: "unknown", // A launchpad event does not determine meme versus utility.
      chainId,
      description: `On-chain launch via ${source.label}`,
      isWatchlisted: false,
    })
    .onConflictDoUpdate({
      target: [tokens.chainId, tokens.address],
      set: {
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
        description: `On-chain launch via ${source.label}`,
      },
    });

  const [tokenRow] = await db
    .select()
    .from(tokens)
    .where(
      and(eq(tokens.chainId, chainId), eq(tokens.address, tokenAddress.toLowerCase()))
    )
    .limit(1);

  if (!tokenRow) return false;

  const evidenceTitle = `onchain launch ${txHash}`;
  const existing = await db
    .select({ id: evidence.id })
    .from(evidence)
    .where(
      and(eq(evidence.tokenId, tokenRow.id), eq(evidence.title, evidenceTitle))
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(evidence).values({
      tokenId: tokenRow.id,
      protocolId: proto?.id ?? null,
      source: "onchain",
      title: evidenceTitle,
      body: JSON.stringify({
        sourceId: source.id,
        label: source.label,
        factory: source.address,
        token: tokenAddress,
        blockNumber,
        txHash,
        logIndex: log.logIndex,
        topic0: log.topics?.[0] ?? source.topic0,
        citations: source.citations,
      }),
      confidence: 0.9,
      url: blockscoutTxUrl(txHash),
    });
  }

  if (proto) {
    await db
      .update(protocols)
      .set({
        factoryAddress:
          source.protocolSlug === "pools-trade"
            ? POOLS_TRADE_ENTRY_CURRENT
            : source.address,
      })
      .where(eq(protocols.id, proto.id));
  }

  console.log(
    `[collector] upsert ${meta.symbol} ${tokenAddress} via ${source.id} @ block ${blockNumber} (${blockscoutTokenUrl(tokenAddress)})`
  );
  return true;
}

export async function runListenerLoop(rpc: RpcClient, intervalMs?: number) {
  const pollMs = Math.max(300_000, intervalMs ?? Number(process.env.COLLECTOR_POLL_MS ?? 300_000)) || 300_000;
  const chainId = rpc.chainId || CHAIN_ID;
  const lookback = Number(process.env.COLLECTOR_LOOKBACK_BLOCKS ?? 5_000);

  console.log(
    `[collector] listener start (configured=${rpc.configured}, chain=${chainId})`
  );
  console.log(
    "[collector] paper mode — eth_getLogs/eth_call only; ENABLE_TRADING ignored"
  );
  console.log(
    "[collector] sample filter:",
    JSON.stringify(sampleLogFilter("0x0", "latest"))
  );

  let db: Db | null = null;
  if (process.env.DATABASE_URL) {
    try {
      db = createDb(process.env.DATABASE_URL);
      await ensureProtocolsVerified(db, rpc);
      console.log("[collector] DATABASE_URL connected; protocol bytecode presence checked");
    } catch (err) {
      console.warn(
        "[collector] DATABASE_URL present but connect failed — logging only:",
        (err as Error).message
      );
      db = null;
    }
  } else {
    console.warn(
      "[collector] DATABASE_URL unset — will poll/decode but skip DB upserts"
    );
  }

  // Start from lookback behind head on first run
  let cursor = loadCursor(0);
  if (cursor.lastBlock === 0 && rpc.configured) {
    const head = await rpc.getBlockNumber();
    if (head != null) {
      cursor = {
        lastBlock: Math.max(0, head - lookback),
        updatedAt: new Date().toISOString(),
      };
      saveCursor(cursor);
      console.log(`[collector] initialized cursor at block ${cursor.lastBlock}`);
    }
  }

  for (;;) {
    await waitForCollection(true);
    try {
      if (!rpc.configured) {
        console.log(
          "[collector] idle tick (set RPC_URL to enable read-only polling)"
        );
      } else {
        const head = await rpc.getBlockNumber();
        if (head == null) {
          console.log("[collector] null head block");
        } else {
          const fromBlock = cursor.lastBlock + 1;
          const toBlock = Math.min(head, fromBlock + 1999);
          if (fromBlock <= toBlock) {
            let ingested = 0;
            for (const source of LAUNCH_POLL_SOURCES) {
              const logs = await rpc.getLogsBatched({
                fromBlock,
                toBlock,
                address: source.address,
                topics: [source.topic0],
              });
              if (logs.length) {
                console.log(
                  `[collector] ${source.id}: ${logs.length} log(s) in ${fromBlock}-${toBlock}`
                );
              }
              for (const log of logs) {
                if (log.removed) continue;
                if (db) {
                  const ok = await upsertLaunch(db, rpc, source, log, chainId);
                  if (ok) ingested++;
                } else {
                  const addr = decodeTokenAddress(source, log);
                  console.log(
                    `[collector] (no-db) ${source.id} token=${addr} tx=${log.transactionHash}`
                  );
                }
              }
            }
            cursor = {
              lastBlock: toBlock,
              updatedAt: new Date().toISOString(),
            };
            saveCursor(cursor);
            console.log(
              `[collector] head ${head}; cursor→${toBlock}; ingested=${ingested}`
            );
          } else {
            console.log(`[collector] head ${head}; up to date`);
          }
        }
      }
    } catch (err) {
      console.error("[collector] tick error", err);
    }
    await sleep(pollMs);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


