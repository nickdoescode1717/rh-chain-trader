import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAddresses, scanAccount, type ScanAccount } from "../src/social/scanner.js";
import { createXReader, XReadError, type XReader } from "../src/social/x-client.js";
const address = `0x${"a".repeat(40)}`;
const account = (): ScanAccount => ({ id: "account-1", handle: "example", xUserId: "123",
  watchFollowing: true, watchFollowers: false, state: { profileSeenAt: 0 } });
const reader = (overrides: Partial<XReader> = {}): XReader => ({
  user: async () => ({ id: "123", username: "example" }),
  userById: async () => ({ id: "123", username: "example" }),
  posts: async () => ({ data: [] }), graph: async () => ({ data: [] }), ...overrides,
});

test("extracts whole addresses, deduplicates case, rejects transaction hashes and zero", () => {
  assert.deepEqual(extractAddresses(`${address} ${address.toUpperCase().replace("0X", "0x")} ${address}abcd 0x${"0".repeat(40)}`), [address]);
});
test("new follow baselines create no false change alerts", async () => {
  const result = await scanAccount(account(), reader({ graph: async () => ({ data: [{ id: "4", username: "four" }] }) }), 1000);
  assert.deepEqual(result.state.following?.baseline, ["4"]);
  assert.equal(result.signals.length, 0);
});
test("complete graph snapshots emit additions and removals only after the final page", async () => {
  const a = account(); a.state.following = { baseline: ["1", "2"] };
  const first = await scanAccount(a, reader({ graph: async () => ({ data: [{ id: "2", username: "two" }], nextToken: "next" }) }), 1000);
  assert.equal(first.signals.length, 0);
  assert.deepEqual(first.state.following?.baseline, ["1", "2"]);
  const second = await scanAccount({ ...a, state: first.state }, reader({ graph: async (_id, _kind, token) => {
    assert.equal(token, "next"); return { data: [{ id: "3", username: "three" }] };
  } }), 2000);
  assert.deepEqual(second.signals.map((s) => s.kind), ["following_added", "following_removed"]);
  assert.deepEqual(second.state.following?.baseline, ["2", "3"]);
});
test("truncated graph snapshots preserve the previous baseline without claiming removals", async () => {
  const a = account(); a.state.following = { baseline: ["1", "2"] };
  const result = await scanAccount(a, reader({ graph: async () => ({ data: [{ id: "3", username: "three" }], nextToken: "more" }) }), 1000, 0, 1);
  assert.equal(result.state.following?.truncated, true);
  assert.deepEqual(result.state.following?.baseline, ["1", "2"]);
  assert.equal(result.signals.filter((signal) => signal.kind.startsWith("following_")).length, 0);
});
test("post since_id advances only after the backlog is drained", async () => {
  const a = account(); a.state.sinceId = "100";
  const first = await scanAccount(a, reader({ posts: async (_id, since) => {
    assert.equal(since, "100"); return { data: [{ id: "300", text: `launch ${address}` }], nextToken: "next" };
  } }), 1000);
  assert.equal(first.state.sinceId, "100");
  assert.equal(first.signals[0].metadata.ownership, "unverified");
  assert.deepEqual(first.signals[0].addresses, [address]);
  const second = await scanAccount({ ...a, state: first.state }, reader({ posts: async (_id, since, token) => {
    assert.equal(since, "100"); assert.equal(token, "next"); return { data: [{ id: "200", text: "older" }] };
  } }), 2000);
  assert.equal(second.state.sinceId, "300");
  assert.equal(second.state.postNextToken, undefined);
});
test("failed scans do not mutate the persisted state", async () => {
  const a = account(); a.state.sinceId = "100";
  await assert.rejects(scanAccount(a, reader({
    posts: async () => ({ data: [{ id: "200", text: "new" }] }),
    graph: async () => { throw new Error("failed"); },
  }), 1000));
  assert.deepEqual(a.state, { profileSeenAt: 0, sinceId: "100" });
});
test("graph polling honors interval and explicitly enabled directions", async () => {
  const a = account(); a.state.following = { baseline: [], lastCompletedAt: 1000 };
  let calls = 0;
  await scanAccount(a, reader({ graph: async () => { calls++; return { data: [] }; } }), 2000);
  assert.equal(calls, 0);
});
test("long posts and expanded URLs are searched, without asserting address ownership", async () => {
  const result = await scanAccount(account(), reader({ posts: async () => ({ data: [{ id: "5", text: "short",
    note_post: { text: "Token launch announcement" }, entities: { urls: [{ expanded_url: `https://example.com/${address}` }] } }] }) }), 1000);
  assert.deepEqual(result.signals[0].addresses, [address]);
  assert.equal(result.signals[0].metadata.launchLanguage, true);
  assert.equal(result.signals[0].metadata.addressRole, "unknown");
});
test("X HTTP 429 surfaces retry time without including bearer token or response content", async () => {
  const api = createXReader("SECRET", (async () => new Response("PRIVATE", { status: 429,
    headers: { "retry-after": "120" } })) as typeof fetch);
  await assert.rejects(api.user("example"), (error: unknown) => error instanceof XReadError
    && error.code === "x_http_429" && error.retryAt > Date.now() + 100_000
    && !error.message.includes("SECRET") && !error.message.includes("PRIVATE"));
});
test("X partial errors and missing data never masquerade as empty snapshots", async () => {
  for (const response of [{ data: [], errors: [{ detail: "denied" }] }, {}]) {
    const api = createXReader("test", (async () => Response.json(response)) as typeof fetch);
    await assert.rejects(api.graph("123", "following"));
  }
});
test("X reader encodes paging, uses only GET, and accepts valid empty timelines", async () => {
  const api = createXReader("test", (async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.host, "api.x.com");
    assert.equal(parsed.searchParams.get("since_id"), "100");
    assert.equal(parsed.searchParams.get("pagination_token"), "next");
    assert.equal(init?.method ?? "GET", "GET");
    assert.equal(init?.redirect, "error");
    return Response.json({ meta: { result_count: 0 } });
  }) as typeof fetch);
  assert.deepEqual(await api.posts("123", "100", "next"), { data: [], nextToken: undefined });
});

test("profile refresh uses pinned ID and picks up new bio addresses", async () => {
  const result = await scanAccount(account(), reader({
    user: async () => { throw new Error("must not re-resolve a handle"); },
    userById: async (id) => {
      assert.equal(id, "123"); return { id, username: "renamed", description: address, public_metrics: { followers_count: 12 } };
    },
  }), 4_000_000);
  assert.equal(result.signals[0].kind, "profile_snapshot");
  assert.deepEqual(result.signals[0].addresses, [address]);
  assert.equal(result.signals[0].sourceUrl, "https://x.com/renamed");
});
