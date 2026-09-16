import assert from "node:assert/strict";
import { test } from "node:test";
import { handleWatchInput, formatWatch, formatLaunch, createWatchAlerts, formatXUsage } from "../src/watches.js";
import type { WatchTarget } from "../src/api.js";
const fixture = (): WatchTarget => ({ id: "a".repeat(8) + "-aaaa-aaaa-aaaa-" + "a".repeat(12), inputKey: "x:project", handle: "project", domain: null,
  enabled: true, projectHandle: null, status: "queued", lastAttemptAt: null, lastError: null, report: null, discovery: null });
test("launch command and toggle carry owner actor without enabling collection or approving trades", async () => {
  const w = fixture(), calls: unknown[] = [];
  const api = { addWatch: async (...a: unknown[]) => { calls.push(a); return w; }, getWatch: async () => w, monitorWatch: async () => w,
    listWatches: async () => [w], listResearchProjects: async () => [], flagLaunch: async (...a: unknown[]) => { calls.push(a); return w; } };
  assert.match((await handleWatchInput(api, "/launch @project", "telegram:42"))!.text, /Collection switches/);
  await handleWatchInput(api, `watch:flag:${w.id}`, "telegram:42");
  assert.deepEqual(calls, [["@project", "telegram:42", true], [w.id, true, "telegram:42"]]);
  const card = formatLaunch(w); assert.match(card.text, /Not armed for trading/);
  assert.ok(card.text.length < 4096);assert.ok(card.reply_markup!.inline_keyboard.flat().every(b => Buffer.byteLength(b.callback_data) <= 64));
});
test("new exact deployment triggers one launch alert across worker restarts", async () => {
  const w = fixture(); w.launchFlag = true; w.discovery = { observedAt: "now", primaryHandle: "project", domain: null, accounts: [], domains: [], links: [], addresses: [], gaps: [] };
  w.launchReport = { version: 1, observedAt: new Date().toISOString(), domain: null, candidates: [], gaps: [], pagesChecked: [], matches: [] };
  let state = {}, sends = 0; const store = { load: () => state, save: (s: {}) => { state = s; } }, api = { listWatches: async () => [w] };
  const send = async () => { sends++; };
  await createWatchAlerts(api, store, "42", send)();
  w.launchReport.matches.push({ tokenAddress: "0x"+"a".repeat(40), deployerAddress: "0x"+"b".repeat(40), creationTxHash: "0x"+"c".repeat(64), factory: "pons", blockNumber: 1, basis: "deployer", claimId: null });
  await createWatchAlerts(api, store, "42", send)(); await createWatchAlerts(api, store, "42", send)();
  assert.equal(sends, 2); assert.match(formatLaunch(w).text, /DEPLOYMENT LEADS/);
});
test("usage card distinguishes reservations from billing and explains rolling limit", () => {
  const c=formatXUsage({dailyLimitUsd:0.5,reservedTodayUsd:0.1,reserved24hUsd:0.2,remainingUsd:0.3,requests24h:10,blockedUntil:null,resetsAt:'later',accounting:'conservative'});
  assert.match(c.text,/\$0.50/);assert.match(c.text,/\$0.3000/);assert.match(c.text,/not the provider invoice/);assert.match(c.text,/rolling 24-hour/);
});
test("one-input watches send the input and owner actor; list includes unresolved watches", async () => {
  const w = fixture(), calls: unknown[] = [];
  const api = { addWatch: async (...a: unknown[]) => { calls.push(a); return w; }, getWatch: async () => w, monitorWatch: async () => w,
    listWatches: async () => [w], listResearchProjects: async () => [] };
  const card = await handleWatchInput(api, "/watch https://x.com/project?s=1", "telegram:42");
  assert.deepEqual(calls, [["https://x.com/project?s=1", "telegram:42"]]); assert.match(card!.text, /Saved/);
  assert.match((await handleWatchInput(api, "/projects", "telegram:42"))!.text, /@project/);
  assert.equal(await handleWatchInput(api, "/balance", "telegram:42"), null);
});
test("watch cards fit Telegram, expose provider gaps and have no approval buttons", () => {
  const w = fixture(); w.discovery = { observedAt: "now", primaryHandle: null, domain: null, accounts: [], domains: [], links: [], addresses: [], gaps: ["twitterapi_setup_pending"] };
  const card = formatWatch(w); assert.match(card.text, /waiting for TwitterAPI.io/); assert.ok(card.text.length < 4096);
  for (const b of card.reply_markup!.inline_keyboard.flat()) { assert.ok(Buffer.byteLength(b.callback_data) <= 64); assert.doesNotMatch(b.callback_data, /approve/); }
});
test("watch alerts survive restart, ignore timestamps and skip paused targets", async () => {
  const w = fixture(); w.discovery = { observedAt: "first", primaryHandle: null, domain: null, accounts: [], domains: [], links: [], addresses: [], gaps: [] };
  let state = {}, sends = 0;
  const store = { load: () => state, save: (s: {}) => { state = s; } }, api = { listWatches: async () => [w] }, send = async () => { sends++; };
  await createWatchAlerts(api, store, "42", send)(); w.discovery.observedAt = "later";
  await createWatchAlerts(api, store, "42", send)(); assert.equal(sends, 1);
  w.enabled = false; w.discovery.domain = "project.org"; await createWatchAlerts(api, store, "42", send)(); assert.equal(sends, 1);
});
