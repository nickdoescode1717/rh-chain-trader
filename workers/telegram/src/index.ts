/**
 * Paper-only Telegram AFK worker.
 *
 * Default: TELEGRAM_DRY_RUN=true (or unset) / no TELEGRAM_BOT_TOKEN → logs only.
 * Live poll: TELEGRAM_DRY_RUN=false AND TELEGRAM_BOT_TOKEN set.
 *
 * Never signs, never loads keys, never submits txs.
 * Approve → API signer_handoff_stub only. Sell buttons = paper propose.
 */

import { createApiClient, type Proposal } from "./api.js";
import { handleCallback } from "./callbacks.js";
import {
  formatLargeMoveAlert,
  formatProposal,
} from "./format.js";
import { createDryRunBot, createTelegramBot } from "./poll.js";

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

function isDryRun(): boolean {
  const flag = env("TELEGRAM_DRY_RUN", "true");
  // dry-run unless explicitly false
  if (flag !== "false") return true;
  if (!env("TELEGRAM_BOT_TOKEN")) return true;
  return false;
}

const API_BASE_URL = env("API_BASE_URL", "http://127.0.0.1:13001")!;
const POLL_MS = Number(env("POLL_MS", "15000")) || 15000;
const CHAT_ID = env("TELEGRAM_CHAT_ID");
const TOKEN = env("TELEGRAM_BOT_TOKEN");
const LARGE_MOVE_PCT = Number(env("LARGE_MOVE_PCT", "25")) || 25;

const dry = isDryRun();
const api = createApiClient(API_BASE_URL);
const liveBot = dry ? null : createTelegramBot(TOKEN, false);
const dryBot = dry ? createDryRunBot() : null;

const notifiedProposals = new Set<string>();
const alertedPositions = new Set<string>();

async function deliver(
  text: string,
  replyMarkup: unknown
): Promise<void> {
  if (!CHAT_ID) {
    console.log(
      "[telegram] TELEGRAM_CHAT_ID unset — logging message only:\n" + text
    );
    return;
  }
  if (liveBot) {
    await liveBot.sendMessage(CHAT_ID, text, replyMarkup);
  } else if (dryBot) {
    await dryBot.sendMessage(CHAT_ID, text, replyMarkup);
  }
}

async function pollProposals(): Promise<void> {
  let proposals: Proposal[];
  try {
    proposals = await api.listProposals();
  } catch (err) {
    console.warn(
      "[telegram] listProposals error:",
      err instanceof Error ? err.message : err
    );
    return;
  }

  const pending = proposals.filter((p) => p.status === "pending_nick");
  for (const p of pending) {
    if (notifiedProposals.has(p.id)) continue;
    const msg = formatProposal(p);
    console.log(`[telegram] new pending proposal ${p.id}`);
    try {
      await deliver(msg.text, msg.reply_markup);
      notifiedProposals.add(p.id);
    } catch (err) {
      console.warn(
        "[telegram] deliver proposal failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function pollPositionsAlerts(): Promise<void> {
  let positions;
  try {
    positions = await api.listPositions();
  } catch (err) {
    console.warn(
      "[telegram] listPositions error:",
      err instanceof Error ? err.message : err
    );
    return;
  }
  if (positions == null) {
    // API dark (403) — expected until paper positions wire-up
    return;
  }

  for (const pos of positions) {
    if (pos.status !== "simulated_open" && pos.status !== "alert_fired") {
      continue;
    }
    const entry = pos.entryPrice != null ? Number(pos.entryPrice) : NaN;
    const mark = pos.currentPrice != null ? Number(pos.currentPrice) : NaN;
    if (!Number.isFinite(entry) || !Number.isFinite(mark) || entry === 0) {
      continue;
    }
    const pct = ((mark - entry) / entry) * 100;
    if (Math.abs(pct) < LARGE_MOVE_PCT) continue;
    if (alertedPositions.has(pos.id)) continue;

    const msg = formatLargeMoveAlert({
      position: pos,
      trigger: {
        kind: "pct",
        value: LARGE_MOVE_PCT,
        direction: pct >= 0 ? "up" : "down",
      },
    });
    console.log(
      `[telegram] LARGE-move paper alert position=${pos.id} pct=${pct.toFixed(1)}`
    );
    try {
      await deliver(msg.text, msg.reply_markup);
      alertedPositions.add(pos.id);
    } catch (err) {
      console.warn(
        "[telegram] deliver alert failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function processTgUpdates(): Promise<void> {
  if (!liveBot) {
    dryBot?.logUpdatesSkipped();
    return;
  }
  const updates = await liveBot.getUpdates(25);
  for (const u of updates) {
    const cq = u.callback_query;
    if (!cq?.data) continue;
    const userId = cq.from?.id ?? "unknown";
    console.log(
      `[telegram] callback from ${userId}: ${cq.data}`
    );
    const result = await handleCallback(api, cq.data, userId);
    console.log(
      `[telegram] callback result ok=${result.ok} action=${result.action} ${result.detail}`
    );
    try {
      await liveBot.answerCallbackQuery(
        cq.id,
        result.ok ? result.detail : `Failed: ${result.detail}`
      );
    } catch (err) {
      console.warn(
        "[telegram] answerCallbackQuery failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function tick(): Promise<void> {
  await pollProposals();
  await pollPositionsAlerts();
}

console.log(
  `[telegram] paper AFK worker starting dryRun=${dry} api=${API_BASE_URL} pollMs=${POLL_MS} chatId=${CHAT_ID ? "set" : "unset"}`
);
console.log(
  "[telegram] ENABLE_TRADING must stay false. No keys. Approve → signer_handoff_stub only."
);

if (dry) {
  // One-shot sample format log so dry-run is obvious
  const sample = formatProposal({
    id: "00000000-0000-0000-0000-000000000000",
    tokenCA: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    chainId: 4663,
    sizeEth: "0.05",
    slippageBps: 100,
    leadSource: "ct",
    status: "pending_nick",
    scores: {
      opportunity: 72,
      risk: 48,
      evidenceConfidence: 0.65,
      framework: "meme",
    },
    rationale: "Dry-run sample — not a real proposal",
  });
  await dryBot!.sendMessage(CHAT_ID ?? "dry-run", sample.text, sample.reply_markup);
}

await tick();

if (dry) {
  // Dry-run: loop API poll only (no TG getUpdates)
  setInterval(() => {
    void tick();
  }, POLL_MS);
  console.log("[telegram] dry-run loop active (API poll only; no Bot API)");
} else {
  // Live: long-poll callbacks + periodic proposal/position poll
  setInterval(() => {
    void tick();
  }, POLL_MS);
  const loop = async () => {
    for (;;) {
      try {
        await processTgUpdates();
      } catch (err) {
        console.warn(
          "[telegram] getUpdates error:",
          err instanceof Error ? err.message : err
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };
  void loop();
  console.log("[telegram] live long-poll active");
}
