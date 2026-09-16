import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResearchProject } from "../src/api.js";
import { createApiClient } from "../src/api.js";
import { formatProposal } from "../src/format.js";
import { isAuthorizedUpdate } from "../src/access.js";
import { candidateAddresses, formatProjectList, formatResearchProject, handleResearchInput } from "../src/research.js";
import { createResearchAlerts, fileAlertStore, researchSignature, type AlertState } from "../src/research-alerts.js";
const fixture = (): ResearchProject => ({ id: "p1", handle: "tradedotcv", domain: "trade.cv", category: "utility", enabled: true,
  lastResearchedAt: "2026-09-09T12:00:00Z", lastError: null, report: {
    researchedAt: "2026-09-09T12:00:00Z", rating: { rating10: null, evidenceCoveragePct: 5, supportedEvidencePoints: 5,
      checks: [{ id: "publicWebsite", label: "Public website", status: "supported" }] },
    subdomains: { discovered: 0, inspected: [], errors: ["certificate_transparency_unavailable"] },
    launchReadiness: { blockers: ["official_token_unverified", "isolated_signer_not_connected"] },
    evidence: [{ id: "e1", url: "https://trade.cv/", kind: "website", finding: "Public homepage" }], grok: { status: "disabled", analysis: null },
  } });
test("high model scores never hide the unverified token identity in paper proposals", () => {
  const card = formatProposal({ id: "p1", tokenCA: `0x${"a".repeat(40)}`, scores: { opportunity: 100, risk: 0, evidenceConfidence: 1, identityVerified: true } });
  assert.match(card.text, /IDENTITY UNVERIFIED/); assert.match(card.text, /Grok provides analysis only/);
});
function fakeApi() {
  const calls: string[] = []; let project = fixture();
  return { calls, api: {
    listResearchProjects: async () => { calls.push("list"); return [project]; },
    getResearchProject: async (handle: string) => { calls.push(`get:${handle}`); return project; },
    watchProject: async (input: { handle: string; domain: string; category: string }) => { calls.push("watch"); project = { ...project, ...input }; return project; },
    setProjectMonitoring: async (handle: string, enabled: boolean) => { calls.push(`monitor:${handle}:${enabled}`); project = { ...project, enabled }; return project; },
  } };
}

test("all inbound commands and callbacks require the configured chat and owner", () => {
  const message = { update_id: 1, message: { message_id: 1, text: "/help", chat: { id: 42 }, from: { id: 42 } } };
  assert.equal(isAuthorizedUpdate(message, "42"), true);
  assert.equal(isAuthorizedUpdate(message), false);
  assert.equal(isAuthorizedUpdate(message, "43"), false);
  assert.equal(isAuthorizedUpdate(message, "42", "43"), false);
  const callback = { update_id: 2, callback_query: { id: "q1", data: "approve:p1", from: { id: 42 }, message: { chat: { id: -99 }, message_id: 1 } } };
  assert.equal(isAuthorizedUpdate(callback, "-99"), false);
  assert.equal(isAuthorizedUpdate(callback, "-99", "42"), true);
  assert.equal(isAuthorizedUpdate({ ...callback, callback_query: { ...callback.callback_query, from: { id: 43 } } }, "-99", "42"), false);
  assert.equal(isAuthorizedUpdate({ update_id: 3, callback_query: { id: "q2", data: "approve:p1", from: { id: 42 } } }, "42"), false);
});
test("research reports show missing evidence and never offer a live buy button", () => {
  const project = fixture(); project.report!.grok = { status: "completed_unverified_model_analysis", analysis: { summary: "x".repeat(20_000), concerns: [], missingEvidence: [] } };
  const card = formatResearchProject(project);
  assert.ok(card.text.length < 4096); assert.match(card.text, /insufficient evidence/); assert.match(card.text, /Coverage: 5%/);
  assert.match(card.text, /Legitimacy unverified/); assert.match(card.text, /official token unverified/);
  assert.ok(card.reply_markup!.inline_keyboard.flat().every((b) => Buffer.byteLength(b.callback_data) <= 64));
  assert.ok(card.reply_markup!.inline_keyboard.flat().every((b) => !b.callback_data.startsWith("approve:")));
  project.report = null; assert.match(formatResearchProject(project).text, /Report pending/);
});
test("project lists are paginated with bounded Telegram keyboards", () => {
  const projects = Array.from({ length: 100 }, (_, i) => ({ ...fixture(), handle: `project${i}` }));
  const card = formatProjectList(projects, 1);
  assert.match(card.text, /Page 2\/17/); assert.match(card.text, /@project6/); assert.doesNotMatch(card.text, /@project0 /);
  assert.ok(card.text.length < 4096); assert.equal(card.reply_markup!.inline_keyboard.length, 8);
});
test("text commands and research buttons use the same report and monitoring API", async () => {
  const { api, calls } = fakeApi();
  assert.match((await handleResearchInput(api, "/start"))!.text, /\/watch/); assert.equal(calls.length, 0);
  assert.match((await handleResearchInput(api, "/research@MyBot @TradeDotCV"))!.text, /@tradedotcv/);
  assert.match((await handleResearchInput(api, "research:pause:tradedotcv", true))!.text, /Paused/);
  assert.match((await handleResearchInput(api, "/resume @tradedotcv"))!.text, /Watching/);
  assert.deepEqual(calls, ["get:tradedotcv", "monitor:tradedotcv:false", "monitor:tradedotcv:true"]);
  assert.equal(await handleResearchInput(api, "/balance"), null);
  assert.equal(await handleResearchInput(api, "approve:p1", true), null);
});
test("repeated watch preserves reports and does not reregister or reset the research schedule", async () => {
  const { api, calls } = fakeApi();
  await handleResearchInput(api, "/watch @tradedotcv trade.cv utility");
  assert.deepEqual(calls, ["get:tradedotcv", "monitor:tradedotcv:true"]);
  assert.match((await handleResearchInput(api, "/watch @tradedotcv unrelated.com"))!.text, /different project details/);
  assert.equal(calls.includes("watch"), false);
});
test("bad commands cause no backend access and provider failures return a concise message", async () => {
  const { api, calls } = fakeApi();
  for (const command of ["/research ../../secrets", "/watch @valid https://trade.cv", "/watch @valid 127.0.0.1", "/watch @valid host.internal", "/pause valid unexpected"]) {
    await handleResearchInput(api, command);
  }
  assert.equal(calls.length, 0);
  const result = await handleResearchInput({ ...api, getResearchProject: async () => { throw new Error("private transport details"); } }, "/research @tradedotcv");
  assert.match(result!.text, /unavailable/); assert.doesNotMatch(result!.text, /private transport details/);
});
test("mentioned addresses exclude transaction hashes, zero and case duplicates", () => {
  const project = fixture(), address = `0x${"ab".repeat(20)}`;
  project.report!.evidence[0].finding = `${address} ${address.toUpperCase().replace("0X", "0x")} 0x${"0".repeat(40)} 0x${"1".repeat(64)}`;
  assert.deepEqual(candidateAddresses(project), [address]);
});
test("research signatures ignore timestamps and Grok wording but react to substantive changes", () => {
  const project = fixture(), before = researchSignature(project);
  project.report!.researchedAt = "2026-09-09T13:00:00Z";
  project.report!.grok = { status: "completed", analysis: { summary: "New wording", concerns: [], missingEvidence: [] } };
  assert.equal(researchSignature(project), before);
  project.report!.subdomains.inspected.push({ host: "api.trade.cv", status: 200 });
  assert.notEqual(researchSignature(project), before);
});
test("alerts persist deduplication across restart and do not refetch unchanged reports", async () => {
  let state: AlertState = {}; const project = fixture(); let details = 0, delivered = 0;
  const store = { load: () => state, save: (next: AlertState) => { state = structuredClone(next); } };
  const api = { listResearchProjects: async () => [project], getResearchProject: async () => { details++; return project; } };
  const send = async () => { delivered++; };
  await createResearchAlerts(api, store, "42", send)();
  await createResearchAlerts(api, store, "42", send)();
  assert.equal(delivered, 1); assert.equal(details, 1);
  project.lastResearchedAt = "2026-09-09T13:00:00Z";
  await createResearchAlerts(api, store, "42", send)();
  assert.equal(delivered, 1); assert.equal(details, 2);
  project.lastResearchedAt = "2026-09-09T14:00:00Z"; project.report!.rating.evidenceCoveragePct = 10;
  await createResearchAlerts(api, store, "42", send)(); assert.equal(delivered, 2);
});
test("failed delivery is retried without marking the report sent; paused projects are skipped", async () => {
  let state: AlertState = {}; const project = fixture(); let attempts = 0;
  const poll = createResearchAlerts({ listResearchProjects: async () => [project], getResearchProject: async () => project },
    { load: () => state, save: (next) => { state = next; } }, "42", async () => { if (++attempts === 1) throw new Error("temporary failure"); });
  await poll(); assert.equal(Object.keys(state).length, 0);
  await poll(); assert.equal(attempts, 2); assert.equal(Object.keys(state).length, 1);
  project.enabled = false; project.lastResearchedAt = "later"; await poll(); assert.equal(attempts, 2);
});
test("alert state is atomically replaced and can be read by a restarted worker", () => {
  const directory = mkdtempSync(join(tmpdir(), "rh-telegram-test-")), path = join(directory, "state.json");
  try {
    const store = fileAlertStore(path); assert.deepEqual(store.load(), {});
    store.save({ first: { snapshot: "a", signature: "1" } }); store.save({ second: { snapshot: "b", signature: "2" } });
    assert.deepEqual(fileAlertStore(path).load(), { second: { snapshot: "b", signature: "2" } });
  } finally { unlinkSync(path); rmdirSync(directory); }
});
test("Telegram API client routes research and monitoring calls without changing trading endpoints", async () => {
  const previous = globalThis.fetch; const calls: { url: string; method?: string; body?: unknown }[] = [];
  try {
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), method: init?.method, body: init?.body }); return Response.json({ data: fixture() }); };
    const api = createApiClient("http://localhost:3001");
    await api.getResearchProject("tradedotcv"); await api.setProjectMonitoring("tradedotcv", false);
    assert.equal(calls[0].url, "http://localhost:3001/research/projects/tradedotcv");
    assert.equal(calls[1].url, "http://localhost:3001/research/projects/tradedotcv/monitoring");
    assert.deepEqual(JSON.parse(String(calls[1].body)), { enabled: false });
  } finally { globalThis.fetch = previous; }
});

test("approval service credential is sent only on decision routes, never research requests", async () => {
  const previous = globalThis.fetch, credential = "test-only-telegram-approval-credential-0000000";
  const sent: RequestInit[] = [];
  try {
    globalThis.fetch = async (_url, init) => { sent.push(init!); return Response.json({ data: fixture() }); };
    const api = createApiClient("http://localhost:3001", credential);
    await api.getResearchProject("tradedotcv"); await api.approveProposal("p1", "telegram:42"); await api.rejectProposal("p1", "telegram:42");
    assert.equal(new Headers(sent[0].headers).has("x-telegram-approval-token"), false);
    assert.equal(new Headers(sent[1].headers).get("x-telegram-approval-token"), credential);
    assert.equal(new Headers(sent[2].headers).get("x-telegram-approval-token"), credential);
    await assert.rejects(createApiClient("http://localhost:3001", "").approveProposal("p1", "telegram:42"), /not configured/);
  } finally { globalThis.fetch = previous; }
});
