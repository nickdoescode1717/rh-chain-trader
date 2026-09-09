import { createHash } from "node:crypto";
import type { XReader, XUser } from "./x-client.js";

export type GraphState = {
  baseline?: string[]; pending?: string[]; nextToken?: string;
  lastCompletedAt?: number; truncated?: boolean;
};
export type ScanState = {
  profileSeenAt?: number;
  sinceId?: string; newestId?: string; postNextToken?: string;
  following?: GraphState; followers?: GraphState;
};
export type ScanAccount = {
  id: string; handle: string; xUserId: string | null;
  watchFollowing: boolean; watchFollowers: boolean; state: ScanState;
};
export type Signal = {
  sourceKey: string; kind: string; sourceUrl: string; text: string;
  addresses: string[]; metadata: Record<string, unknown>; publishedAt: Date | null;
};
export type ScanResult = { xUserId: string; state: ScanState; signals: Signal[] };

export function extractAddresses(text: string): string[] {
  return [...new Set([...text.matchAll(/(?<![a-zA-Z0-9_])0x[0-9a-fA-F]{40}(?![a-zA-Z0-9_])/g)]
    .map((m) => m[0].toLowerCase()))].filter((a) => a !== `0x${"0".repeat(40)}`);
}
const digest = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 24);
const maximumId = (a: string | undefined, b: string) => !a || BigInt(b) > BigInt(a) ? b : a;
function checkUser(user: XUser) {
  if (!user || typeof user.id !== "string" || !/^\d+$/.test(user.id) ||
      typeof user.username !== "string" || !/^[A-Za-z0-9_]{1,15}$/.test(user.username)) throw new Error("x_invalid_user");
}

/** One page per enabled stream, bounded cost; commit state and signals atomically after success. */
export async function scanAccount(
  account: ScanAccount, reader: XReader, now: number,
  graphIntervalMs = 3_600_000, maxGraphUsers = 10_000,
): Promise<ScanResult> {
  const state: ScanState = structuredClone(account.state);
  const signals: Signal[] = [];
  let xUserId = account.xUserId;
  if (!xUserId || state.profileSeenAt === undefined || now - state.profileSeenAt >= graphIntervalMs) {
    const user = xUserId ? await reader.userById(xUserId) : await reader.user(account.handle);
    checkUser(user);
    xUserId = user.id;
    state.profileSeenAt = now;
    const text = user.description ?? "";
    signals.push({
      sourceKey: `${account.id}:profile:${user.id}:${digest(JSON.stringify([text, user.public_metrics ?? {}]))}`,
      kind: "profile_snapshot", sourceUrl: `https://x.com/${user.username}`, text,
      addresses: extractAddresses(text), metadata: { ownership: "unverified", xUserId, metrics: user.public_metrics ?? {} }, publishedAt: null,
    });
  }
  if (!xUserId) throw new Error("x_user_id_missing");
  const page = await reader.posts(xUserId, state.sinceId, state.postNextToken);
  if (page.nextToken && page.nextToken === state.postNextToken) throw new Error("x_repeated_page_token");
  for (const post of page.data) {
    if (!post || typeof post.id !== "string" || !/^\d+$/.test(post.id) || typeof post.text !== "string") throw new Error("x_invalid_post");
    state.newestId = maximumId(state.newestId, post.id);
    const text = post.note_post?.text ?? post.text;
    const expandedUrls = (post.entities?.urls ?? []).map((u) => u.expanded_url ?? "");
    const addresses = extractAddresses([text, ...expandedUrls].join(" "));
    const launchLanguage = /\b(launch(?:ing|es|ed)?|token|contract|deploy(?:ing|ed)?|tge|mint|presale|fairlaunch)\b/i.test(text);
    // All posts retained as evidence; language is a heuristic, never a buy signal.
    const publishedAt = post.created_at ? new Date(post.created_at) : null;
    if (publishedAt && !Number.isFinite(publishedAt.getTime())) throw new Error("x_invalid_post_date");
    signals.push({
      sourceKey: `${account.id}:post:${post.id}`, kind: "post",
      sourceUrl: `https://x.com/i/status/${post.id}`, text, addresses,
      metadata: { xUserId, metrics: post.public_metrics ?? {}, launchLanguage,
        addressRole: "unknown", ownership: "unverified", expandedUrls }, publishedAt,
    });
  }
  state.postNextToken = page.nextToken;
  // Do not skip the backlog: advance since_id only after all pages are committed.
  if (!page.nextToken) { state.sinceId = state.newestId ?? state.sinceId; delete state.newestId; }

  for (const kind of ["following", "followers"] as const) {
    if (!(kind === "following" ? account.watchFollowing : account.watchFollowers)) continue;
    const graph = state[kind] ?? {};
    if (!graph.nextToken && graph.lastCompletedAt !== undefined && now - graph.lastCompletedAt < graphIntervalMs) continue;
    const next = await reader.graph(xUserId, kind, graph.nextToken);
    if (next.nextToken && next.nextToken === graph.nextToken) throw new Error("x_repeated_page_token");
    for (const user of next.data) checkUser(user);
    const accumulated = [...new Set([...(graph.pending ?? []), ...next.data.map((u) => u.id)])];
    // A bounded/partial snapshot must never imply removals or a completed baseline.
    if (accumulated.length > maxGraphUsers || (accumulated.length >= maxGraphUsers && next.nextToken)) {
      state[kind] = { baseline: graph.baseline, lastCompletedAt: now, truncated: true };
      continue;
    }
    for (const user of next.data) {
      const text = user.description ?? "";
      const addresses = extractAddresses(text);
      if (addresses.length) signals.push({
        sourceKey: `${account.id}:${kind}:profile:${user.id}:${digest(text)}`,
        kind: "related_profile_address", sourceUrl: `https://x.com/${user.username}`,
        text, addresses, metadata: { relation: kind, relatedUserId: user.id, ownership: "unverified" }, publishedAt: null,
      });
    }
    if (next.nextToken) {
      state[kind] = { ...graph, pending: accumulated, nextToken: next.nextToken };
      continue;
    }
    if (graph.baseline !== undefined) {
      const before = new Set(graph.baseline), after = new Set(accumulated);
      const snapshot = digest([...accumulated].sort().join(","));
      for (const [change, ids] of [
        ["added", accumulated.filter((id) => !before.has(id))],
        ["removed", graph.baseline.filter((id) => !after.has(id))],
      ] as const) for (const id of ids) signals.push({
        sourceKey: `${account.id}:${kind}:${change}:${id}:${now}:${snapshot}`,
        kind: `${kind}_${change}`, sourceUrl: `https://x.com/i/user/${id}`,
        text: `Observed ${kind} ${change}: X user ${id}`,
        addresses: [], metadata: { relatedUserId: id, observedChangeOnly: true }, publishedAt: null,
      });
    }
    state[kind] = { baseline: accumulated, lastCompletedAt: now, truncated: false };
  }
  return { xUserId, state, signals };
}
