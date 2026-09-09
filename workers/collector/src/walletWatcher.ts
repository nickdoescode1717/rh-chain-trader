/**
 * Watched-wallet Transfer poller (paper / research only).
 * Empty wallet list is valid — skip poll, stay healthy.
 * Never submits txs. Factory launch ingest stays corroboration-only (listener.ts).
 *
 * Filter stubs (WATCH_MIN_MCAP_USD, WATCH_MAX_MCAP_USD, WATCH_MIN_LIQ_USD,
 * WATCH_MAX_TOKEN_AGE_HOURS): if unset, accept all. Mcap/liq filtering is a
 * no-op stub until a price oracle exists.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { and, eq, desc, ne } from "drizzle-orm";
import { CHAIN_ID, ERC20_TRANSFER } from "@rh/core";
import {
  createDb,
  tokens,
  wallets,
  walletEvents,
  type Db,
} from "@rh/db";
import type { RpcClient, RpcLog } from "./rpc.js";
import {
  addressFromWord,
  addressToTopic,
  decodeUint256,
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
    process.env.WALLET_CURSOR_PATH ??
      new URL("../data/wallet-cursor.json", import.meta.url).pathname
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
    console.warn("[wallet-watcher] cursor read failed, starting fresh", err);
  }
  return { lastBlock: defaultBlock, updatedAt: new Date().toISOString() };
}

function saveCursor(state: CursorState) {
  const path = cursorPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Stub filters — all unset ⇒ accept. Documented until price oracle. */
function passesFilterStubs(_ctx: {
  tokenAddress: string;
  amount: string;
}): boolean {
  const minMcap = process.env.WATCH_MIN_MCAP_USD;
  const maxMcap = process.env.WATCH_MAX_MCAP_USD;
  const minLiq = process.env.WATCH_MIN_LIQ_USD;
  const maxAge = process.env.WATCH_MAX_TOKEN_AGE_HOURS;
  // No oracle yet: if any filter env is set, log once per process that stubs are inactive.
  if (minMcap || maxMcap || minLiq || maxAge) {
    // Intentionally accept all — mcap/liq/age require oracle / token createdAt heuristics later.
  }
  return true;
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
      `[wallet-watcher] erc20 meta failed for ${tokenAddress}:`,
      (err as Error).message
    );
  }
  return { name, symbol, decimals };
}

async function otherWatchedOnToken(
  db: Db,
  tokenId: string,
  excludeWalletId: string,
  watchedIds: string[]
): Promise<string[]> {
  if (watchedIds.length <= 1) return [];
  const recent = await db
    .select({
      walletId: walletEvents.walletId,
      address: wallets.address,
    })
    .from(walletEvents)
    .innerJoin(wallets, eq(walletEvents.walletId, wallets.id))
    .where(
      and(
        eq(walletEvents.tokenId, tokenId),
        ne(walletEvents.walletId, excludeWalletId)
      )
    )
    .orderBy(desc(walletEvents.observedAt))
    .limit(50);

  const watchedSet = new Set(watchedIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of recent) {
    if (!watchedSet.has(r.walletId)) continue;
    const a = r.address.toLowerCase();
    if (seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

async function ingestTransfer(
  db: Db,
  rpc: RpcClient,
  log: RpcLog,
  watched: { id: string; address: string }[],
  chainId: number
): Promise<boolean> {
  const to = addressFromWord(log.topics?.[2]);
  if (!to) return false;
  const wallet = watched.find((w) => w.address === to.toLowerCase());
  if (!wallet) return false;

  const from = addressFromWord(log.topics?.[1]);
  const tokenAddress = (log.address ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(tokenAddress)) return false;

  const amount = decodeUint256(log.data) ?? "0";
  if (!passesFilterStubs({ tokenAddress, amount })) return false;

  const meta = await fetchErc20Meta(rpc, tokenAddress);
  const blockNumber = parseInt(log.blockNumber, 16);
  const txHash = log.transactionHash;

  await db
    .insert(tokens)
    .values({
      address: tokenAddress,
      symbol: meta.symbol,
      name: meta.name,
      decimals: meta.decimals,
      category: "unknown",
      chainId,
      description: "Seen via watched-wallet transfer_in",
      isWatchlisted: false,
    })
    .onConflictDoUpdate({
      target: [tokens.chainId, tokens.address],
      set: {
        symbol: meta.symbol,
        name: meta.name,
        decimals: meta.decimals,
      },
    });

  const [tokenRow] = await db
    .select()
    .from(tokens)
    .where(and(eq(tokens.chainId, chainId), eq(tokens.address, tokenAddress)))
    .limit(1);
  if (!tokenRow) return false;

  // Dedupe by tx + wallet + token
  const existing = await db
    .select({ id: walletEvents.id })
    .from(walletEvents)
    .where(
      and(
        eq(walletEvents.walletId, wallet.id),
        eq(walletEvents.tokenId, tokenRow.id),
        eq(walletEvents.txHash, txHash),
        eq(walletEvents.eventType, "transfer_in")
      )
    )
    .limit(1);
  if (existing.length > 0) return false;

  const others = await otherWatchedOnToken(
    db,
    tokenRow.id,
    wallet.id,
    watched.map((w) => w.id)
  );

  await db.insert(walletEvents).values({
    walletId: wallet.id,
    tokenId: tokenRow.id,
    eventType: "transfer_in",
    txHash,
    blockNumber,
    amount,
    metadata: {
      from: from?.toLowerCase() ?? null,
      otherWatchedOnToken: others,
      // Desk lead fields mirrored for consumers reading raw rows
      leadSource: "watched_wallet",
      entryEstimate: null,
      amountUsd: null,
    },
  });

  console.log(
    `[wallet-watcher] transfer_in ${meta.symbol}→${wallet.address} amount=${amount} tx=${txHash} block=${blockNumber}`
  );
  return true;
}

export async function runWalletWatcherLoop(
  rpc: RpcClient,
  intervalMs?: number
) {
  const pollMs = intervalMs ?? Number(process.env.COLLECTOR_POLL_MS ?? 15_000);
  const chainId = rpc.chainId || CHAIN_ID;
  const lookback = Number(process.env.COLLECTOR_LOOKBACK_BLOCKS ?? 5_000);
  // Alchemy free-tier: keep LOG_BLOCK_WINDOW small (~10)
  const windowSize = Number(process.env.LOG_BLOCK_WINDOW ?? 10);

  console.log(
    `[wallet-watcher] start (configured=${rpc.configured}, chain=${chainId}, window=${windowSize})`
  );
  console.log(
    "[wallet-watcher] paper mode — eth_getLogs only; empty wallet list = healthy skip"
  );
  console.log(
    "[wallet-watcher] filter stubs WATCH_*_MCAP/LIQ/AGE: unset=accept all; mcap/liq stub until price oracle"
  );

  let db: Db | null = null;
  if (process.env.DATABASE_URL) {
    try {
      db = createDb(process.env.DATABASE_URL);
      console.log("[wallet-watcher] DATABASE_URL connected");
    } catch (err) {
      console.warn(
        "[wallet-watcher] DB connect failed — cannot watch:",
        (err as Error).message
      );
      db = null;
    }
  } else {
    console.warn(
      "[wallet-watcher] DATABASE_URL unset — skip (empty-ready / no-op)"
    );
  }

  let cursor = loadCursor(0);
  let loggedEmpty = false;

  if (cursor.lastBlock === 0 && rpc.configured) {
    const head = await rpc.getBlockNumber();
    if (head != null) {
      cursor = {
        lastBlock: Math.max(0, head - lookback),
        updatedAt: new Date().toISOString(),
      };
      saveCursor(cursor);
      console.log(
        `[wallet-watcher] initialized cursor at block ${cursor.lastBlock}`
      );
    }
  }

  for (;;) {
    try {
      if (!db) {
        // Stay healthy without DB
      } else if (!rpc.configured) {
        // idle
      } else {
        const watchedRows = await db.select().from(wallets);
        const watched = watchedRows.map((w) => ({
          id: w.id,
          address: w.address.toLowerCase(),
        }));

        if (watched.length === 0) {
          if (!loggedEmpty) {
            console.log(
              "[wallet-watcher] no watched wallets — empty list OK; skipping polls until addresses added via POST /watched-wallets"
            );
            loggedEmpty = true;
          }
        } else {
          loggedEmpty = false;
          const head = await rpc.getBlockNumber();
          if (head != null) {
            const fromBlock = cursor.lastBlock + 1;
            const toBlock = head;
            if (fromBlock <= toBlock) {
              let ingested = 0;
              // One eth_getLogs per watched wallet (topic2 = to), small windows
              for (const w of watched) {
                const logs = await rpc.getLogsBatched(
                  {
                    fromBlock,
                    toBlock,
                    topics: [ERC20_TRANSFER, null, addressToTopic(w.address)],
                  },
                  windowSize
                );
                for (const log of logs) {
                  if (log.removed) continue;
                  const ok = await ingestTransfer(
                    db,
                    rpc,
                    log,
                    watched,
                    chainId
                  );
                  if (ok) ingested++;
                }
              }
              cursor = {
                lastBlock: toBlock,
                updatedAt: new Date().toISOString(),
              };
              saveCursor(cursor);
              console.log(
                `[wallet-watcher] head ${head}; cursor→${toBlock}; wallets=${watched.length}; ingested=${ingested}`
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("[wallet-watcher] tick error", err);
    }
    await sleep(pollMs);
  }
}
