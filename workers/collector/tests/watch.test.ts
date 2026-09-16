import assert from "node:assert/strict";
import { test } from "node:test";
import { watchInput } from "@rh/core";
import { discoverWatch } from "../src/research/watch-discovery.js";
import { createWatchSocialReader } from "../src/research/twitterapi.js";
const page = (text: string, url = "https://project.org/") => ({ text, url, status: 200, contentType: "text/html" });
test("watch input canonicalizes X profile links and websites; rejects posts and unsafe targets", () => {
  for (const input of ["@Project", "project", "https://x.com/Project?s=11", "twitter.com/project/"]) assert.equal(watchInput(input).key, "x:project");
  assert.deepEqual(watchInput("https://project.org/about?q=1"), { key: "site:project.org", handle: null, domain: "project.org" });
  for (const input of ["https://x.com/project/status/123", "https://x.com/intent", "https://user:pass@project.org", "https://127.0.0.1/", "file:///a", "https://project.org:8443", "https://a.internal", "https://x.com.evil.org/\\x"]) assert.throws(() => watchInput(input));
});
test("website intake discovers bounded linked accounts/docs without requiring X access", async () => {
  const reads: string[] = [];
  const { discovery } = await discoverWatch({ handle: null, domain: "project.org" }, async url => {
    reads.push(url); return page('<a href="https://x.com/project">X</a><a href="/team">Team</a><a href="https://github.com/project/code">Code</a>', url);
  });
  assert.equal(discovery.primaryHandle, "project"); assert.equal(discovery.accounts[0].relation, "website_link_unverified");
  assert.ok(discovery.gaps.includes("twitterapi_setup_pending")); assert.ok(discovery.links.some(l => l.kind === "repository_link"));
  assert.ok(reads.length <= 3);
});
test("multiple site accounts remain ambiguous; script links are ignored", async () => {
  const { discovery } = await discoverWatch({ handle: null, domain: "project.org" }, async () => page('<script><a href="https://x.com/fake">X</a></script><a href="https://x.com/team">Team</a><a href="https://x.com/project">X</a>'));
  assert.equal(discovery.primaryHandle, null); assert.equal(discovery.accounts.length, 2);
  assert.ok(discovery.gaps.includes("multiple_linked_accounts"));
});
test("X input finds profile domain and related bios/posts without granting trust", async () => {
  const calls: string[] = [], address = `0x${"a".repeat(40)}`;
  const { discovery, posts } = await discoverWatch({ handle: "project", domain: null }, async () => page('<a href="https://x.com/project">X</a>'), {
    profile: async h => { calls.push(h); return { handle: h, id: "1", description: h === "project" ? "Built by @builder" : "Builder", domains: h === "project" ? ["project.org"] : [] }; },
    posts: async h => [{ text: `Mention ${address}`, url: `https://x.com/${h}/status/1`, publishedAt: null }],
  });
  assert.equal(discovery.domain, "project.org"); assert.deepEqual(calls, ["project", "builder"]); assert.equal(posts.length, 2);
  assert.equal(discovery.accounts[1].relation, "bio_mention_unverified"); assert.equal(discovery.addresses[0].address, address);
  assert.equal("verified" in discovery, false);
});
test("conflicting/missing website links are not guessed, failed X reads retain website work", async () => {
  const social = { profile: async () => ({ handle: "project", id: "1", description: "", domains: ["one.org", "two.org"] }), posts: async () => [] };
  const { discovery } = await discoverWatch({ handle: "project", domain: null }, async () => { throw new Error("must not guess"); }, social);
  assert.equal(discovery.domain, null); assert.ok(discovery.gaps.includes("multiple_profile_websites"));
  const result = await discoverWatch({ handle: "project", domain: "project.org" }, async () => page("hello"), social);
  assert.ok(result.discovery.gaps.includes("profile_domain_conflict"));
});
test("TwitterAPI.io uses expanded profile URLs and exact author matching; errors fail closed", async () => {
  const requests: string[] = [];
  const client = createWatchSocialReader("fixture-key", async (url, init) => {
    requests.push(String(url)); assert.equal(new Headers(init?.headers).get("X-API-Key"), "fixture-key");
    assert.equal(new Headers(init?.headers).has("Authorization"), false); assert.equal(init?.redirect, "error");
    if (String(url).includes("/info?")) return Response.json({ status: "success", data: { userName: "Project", id: "123", url: "https://x.com/project", profile_bio: { entities: { url: { urls: [{ expanded_url: "https://project.org/" }] } } } } });
    return Response.json({ status: "success", tweets: [{ id: "1", text: "ok", author: { userName: "project" } }, { id: "2", text: "fake", author: { userName: "copycat" } }] });
  });
  assert.deepEqual((await client.profile("project")).domains, ["project.org"]); assert.equal((await client.posts("project")).length, 1);
  assert.ok(requests.every(u => u.startsWith("https://api.twitterapi.io/")));
  await assert.rejects(createWatchSocialReader("fixture", async () => Response.json({ status: "error" })).profile("project"));
  await assert.rejects(createWatchSocialReader("fixture", async () => new Response("", { status: 429 })).profile("project"));
});
