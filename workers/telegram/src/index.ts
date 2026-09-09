/**
 * Paper-only Telegram AFK worker.
 * Desk-order proposals, post-approve paper fill, /balance + /positions.
 * Never signs, never loads keys, never submits txs.
 * Catch-up fill receipts after restart (survive TG recreate).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createApiClient, type Proposal, type Position } from "./api.js";
import { handleCallback } from "./callbacks.js";
import {
  fillFromApprove,
  fillFromPosition,
  handleBalanceCommand,
  handlePositionsCommand,
  isBalanceCommand,
  isPositionsCommand,
} from "./commands.js";
import {
  formatLargeMoveAlert,
  formatProposal,
} from "./format.js";
import { createDryRunBot, createTelegramBot } from "./poll.js";
import { isAuthorizedUpdate } from "./access.js";
import { handleResearchInput } from "./research.js";
import { handlePortfolioCallback } from "./portfolio.js";
import { createResearchAlerts, fileAlertStore } from "./research-alerts.js";

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

function isDryRun(): boolean {
  const flag = env("TELEGRAM_DRY_RUN", "true");
  if (flag !== "false") return true;
  if (!env("TELEGRAM_BOT_TOKEN")) return true;
  return false;
}

const API_BASE_URL = env("API_BASE_URL", "http://127.0.0.1:13001")!;
const POLL_MS = Number(env("POLL_MS", "15000")) || 15000;
const CHAT_ID = env("TELEGRAM_CHAT_ID");
const OWNER_ID = env("TELEGRAM_OWNER_USER_ID");
const TOKEN = env("TELEGRAM_BOT_TOKEN");
const LARGE_MOVE_PCT = Number(env("LARGE_MOVE_PCT", "25")) || 25;
const FILL_STATE_PATH =
  env("TG_FILL_STATE_PATH", "/tmp/rh-tg-fill-sent.json")!;

const dry = isDryRun();
const api = createApiClient(API_BASE_URL);
const liveBot = dry ? null : createTelegramBot(TOKEN, false);
const dryBot = dry ? createDryRunBot() : null;
let pollResearch = async () => {};
if (liveBot && CHAT_ID) {
  try {
    pollResearch = createResearchAlerts(api, fileAlertStore(env("TG_RESEARCH_STATE_PATH", "/tmp/rh-tg-research-sent.json")!), CHAT_ID,
      async (card) => { await liveBot.sendMessage(CHAT_ID, card.text, card.reply_markup); });
  } catch { console.warn("[telegram] research alert state unavailable; automatic research alerts disabled until restart. Commands still work."); }
}
let nextResearchPoll = 0;

const notifiedProposals = new Set<string>();
const alertedPositions = new Set<string>();
const fillReceiptSent = new Set<string>();

function loadFillState(): void {
  try {
    if (!existsSync(FILL_STATE_PATH)) return;
    const raw = JSON.parse(readFileSync(FILL_STATE_PATH, "utf8")) as {
      proposalIds?: string[];
    };
    for (const id of raw.proposalIds ?? []) {
      if (typeof id === "string" && id) fillReceiptSent.add(id);
    }
    console.log(
      `[telegram] loaded ${fillReceiptSent.size} fill-receipt ids from ${FILL_STATE_PATH}`
    );
  } catch (err) {
    console.warn(
      "[telegram] fill-state load failed:",
      err instanceof Error ? err.message : err
    );
  }
}

function saveFillState(): void {
  try {
    writeFileSync(
      FILL_STATE_PATH,
      JSON.stringify({ proposalIds: [...fillReceiptSent] }),
      "utf8"
    );
  } catch (err) {
    console.warn(
      "[telegram] fill-state save failed:",
      err instanceof Error ? err.message : err
    );
  }
}

function markFillSent(proposalId: string): void {
  if (!proposalId) return;
  fillReceiptSent.add(proposalId);
  saveFillState();
}

async function deliver(text: string, replyMarkup?: unknown): Promise<void> {
  if (!CHAT_ID) {
    console.log("[telegram] TELEGRAM_CHAT_ID unset — logging only:\n" + text);
    return;
  }
  if (liveBot) await liveBot.sendMessage(CHAT_ID, text, replyMarkup);
  else if (dryBot) await dryBot.sendMessage(CHAT_ID, text, replyMarkup);
}

async function pollProposals(): Promise<void> {
  let proposals: Proposal[];
  try {
    proposals = await api.listProposals();
  } catch (err) {
    console.warn("[telegram] listProposals error:", err instanceof Error ? err.message : err);
    return;
  }
  for (const p of proposals.filter((x) => x.status === "pending_nick")) {
    if (notifiedProposals.has(p.id)) continue;
    const msg = formatProposal(p);
    console.log(`[telegram] new pending proposal ${p.id}`);
    try {
      await deliver(msg.text, msg.reply_markup);
      notifiedProposals.add(p.id);
    } catch (err) {
      console.warn("[telegram] deliver proposal failed:", err instanceof Error ? err.message : err);
    }
  }
}

/**
 * After TG restart: send paper fill for open positions
 * whose proposalId has no recorded receipt yet. Paper only.
 */
async function pollMissedFills(positions: Position[] | null): Promise<void> {
  if (positions == null) return;
  for (const pos of positions) {
    if (pos.status !== "simulated_open" && pos.status !== "alert_fired") continue;
    const proposalId =
      typeof pos.proposalId === "string" ? pos.proposalId : null;
    if (!proposalId) continue;
    if (fillReceiptSent.has(proposalId)) continue;
    try {
      const fill = fillFromPosition(pos, proposalId);
      await deliver(fill.text);
      markFillSent(proposalId);
      console.log(
        `[telegram] catch-up paper fill receipt for proposal=${proposalId} position=${pos.id}`
      );
    } catch (err) {
      console.warn(
        "[telegram] catch-up fill failed:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function pollPositionsAlerts(positions: Position[] | null): Promise<void> {
  if (positions == null) return;
  for (const pos of positions) {
    if (pos.status !== "simulated_open" && pos.status !== "alert_fired") continue;
    const entry = pos.entryPrice != null ? Number(pos.entryPrice) : NaN;
    const mark = pos.currentPrice != null ? Number(pos.currentPrice) : NaN;
    if (!Number.isFinite(entry) || !Number.isFinite(mark) || entry === 0) continue;
    const pct = ((mark - entry) / entry) * 100;
    if (Math.abs(pct) < LARGE_MOVE_PCT) continue;
    if (alertedPositions.has(pos.id)) continue;
    const msg = formatLargeMoveAlert({
      position: pos,
      trigger: { kind: "pct", value: LARGE_MOVE_PCT, direction: pct >= 0 ? "up" : "down" },
    });
    console.log(`[telegram] LARGE-move paper alert position=${pos.id} pct=${pct.toFixed(1)}`);
    try {
      await deliver(msg.text, msg.reply_markup);
      alertedPositions.add(pos.id);
    } catch (err) {
      console.warn("[telegram] deliver alert failed:", err instanceof Error ? err.message : err);
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
    try {
    // Gate both commands and callbacks before any backend access, including paper approvals.
    if (!isAuthorizedUpdate(u, CHAT_ID, OWNER_ID)) continue;
    const msg = u.message;
    if (msg?.text) {
      const card = await handleResearchInput(api, msg.text);
      if (card) { await liveBot.sendMessage(msg.chat.id, card.text, card.reply_markup); continue; }
    }
    if (msg?.text && isBalanceCommand(msg.text)) {
      console.log(`[telegram] /balance from ${msg.from?.id ?? "?"}`);
      try {
        await handleBalanceCommand(api, msg.chat.id, CHAT_ID, (id, text, keyboard) =>
          liveBot.sendMessage(id, text, keyboard)
        );
      } catch (err) {
        console.warn("[telegram] /balance failed:", err instanceof Error ? err.message : err);
      }
      continue;
    }
    if (msg?.text && isPositionsCommand(msg.text)) {
      console.log(`[telegram] /positions from ${msg.from?.id ?? "?"}`);
      try {
        await handlePositionsCommand(api, msg.chat.id, CHAT_ID, (id, text, keyboard) =>
          liveBot.sendMessage(id, text, keyboard)
        );
      } catch (err) {
        console.warn("[telegram] /positions failed:", err instanceof Error ? err.message : err);
      }
      continue;
    }

    const cq = u.callback_query;
    if (!cq?.data) continue;
    if (cq.data.startsWith("portfolio:")) {
      await liveBot.answerCallbackQuery(cq.id, "Updating portfolio…");
      const card = await handlePortfolioCallback(api, cq.data);
      if (card) await liveBot.editMessage(cq.message!.chat.id, cq.message!.message_id, card.text, card.reply_markup);
      continue;
    }
    if (cq.data.startsWith("research:")) {
      await liveBot.answerCallbackQuery(cq.id, "Updating research view…");
      const card = await handleResearchInput(api, cq.data, true);
      if (card) await liveBot.editMessage(cq.message!.chat.id, cq.message!.message_id, card.text, card.reply_markup);
      continue;
    }
    const userId = cq.from?.id ?? "unknown";
    console.log(`[telegram] callback from ${userId}: ${cq.data}`);
    const result = await handleCallback(api, cq.data, userId);
    console.log(`[telegram] callback result ok=${result.ok} action=${result.action} ${result.detail}`);
    try {
      await liveBot.answerCallbackQuery(
        cq.id,
        result.ok ? result.detail : `Failed: ${result.detail}`
      );
    } catch (err) {
      console.warn("[telegram] answerCallbackQuery failed:", err instanceof Error ? err.message : err);
    }

    if (result.ok && result.action === "approve" && result.proposalId) {
      try {
        const fill = fillFromApprove(result.apiBody, result.proposalId);
        await deliver(fill.text);
        markFillSent(result.proposalId);
        console.log(`[telegram] paper fill receipt sent for ${result.proposalId}`);
      } catch (err) {
        console.warn("[telegram] paper fill receipt failed:", err instanceof Error ? err.message : err);
      }
    } else if (result.ok && result.action === "reject" && result.proposalId) {
      try {
        await deliver(`—— SKIPPED ——\nProposal ${result.proposalId} rejected (paper). No fill.`);
      } catch {
        /* ignore */
      }
    }
    } catch { console.warn("[telegram] update processing failed; continuing with remaining updates"); }
  }
}

async function tick(): Promise<void> {
  await pollProposals();
  try {
    const positions = await api.listPositions();
    await pollMissedFills(positions);
    await pollPositionsAlerts(positions);
  } catch { console.warn("[telegram] position poll unavailable; will retry"); }
  if (Date.now() >= nextResearchPoll) {
    nextResearchPoll = Date.now() + 60_000;
    try { await pollResearch(); } catch { console.warn("[telegram] research poll unavailable; will retry"); }
  }
}

loadFillState();

console.log(
  `[telegram] paper AFK worker starting dryRun=${dry} api=${API_BASE_URL} pollMs=${POLL_MS} chatId=${CHAT_ID ? "set" : "unset"}`
);
console.log("[telegram] ENABLE_TRADING must stay false. No keys. Approve → position + signer_handoff_stub.");

if (dry) {
  const sample = formatProposal({
    id: "00000000-0000-0000-0000-000000000000",
    tokenCA: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    chainId: 4663,
    sizeEth: "0.05",
    slippageBps: 100,
    leadSource: "ct",
    status: "pending_nick",
    scores: { opportunity: 72, risk: 48, evidenceConfidence: 0.65, framework: "meme", symbol: "SAMPLE" },
    rationale: "Dry-run sample — not a real proposal",
    sources: [{ kind: "ct", handle: "@example", note: "dry-run" }],
  });
  await dryBot!.sendMessage(CHAT_ID ?? "dry-run", sample.text, sample.reply_markup);
}

await tick();

// Schedule only after completion so slow API/Telegram requests never overlap the next tick.
async function runPolling(): Promise<void> {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    try { await tick(); } catch { console.warn("[telegram] poll failed; will retry"); }
  }
}
void runPolling();

if (dry) {
  console.log("[telegram] dry-run loop active (API poll only; no Bot API)");
} else {
  const loop = async () => {
    for (;;) {
      try {
        await processTgUpdates();
      } catch (err) {
        console.warn("[telegram] getUpdates error:", err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };
  void loop();
  console.log("[telegram] live long-poll active");
}
