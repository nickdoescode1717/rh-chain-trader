import { watchInput, xHandle } from "@rh/core";
export type WatchProfile = { handle: string; id: string; description: string; domains: string[] };
export type WatchPost = { text: string; url: string; publishedAt: string | null };
export interface WatchSocialReader {
  profile(handle: string): Promise<WatchProfile>;
  posts(handle: string): Promise<WatchPost[]>;
}
/** Fixed read-only vendor endpoints. This credential is never an official-X bearer token. */
export function createWatchSocialReader(key: string, fetcher: typeof fetch = fetch): WatchSocialReader {
  async function read(endpoint: "info" | "last_tweets", handle: string) {
    if (xHandle(handle) !== handle) throw new Error("invalid_handle");
    const url = new URL(`https://api.twitterapi.io/twitter/user/${endpoint}`);
    url.searchParams.set("userName", handle);
    const response = await fetcher(url, { headers: { "X-API-Key": key }, redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("x_provider_unavailable");
    const reader = response.body?.getReader(); if (!reader) throw new Error("x_invalid_response");
    let size = 0; const chunks: Uint8Array[] = [];
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > 1_000_000) { await reader.cancel(); throw new Error("x_response_too_large"); }
      chunks.push(part.value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (body?.status !== "success") throw new Error("x_invalid_response");
    return body;
  }
  return {
    async profile(handle) {
      const user = (await read("info", handle)).data;
      if (!user || xHandle(user.userName ?? "") !== handle || typeof user.id !== "string" || !/^\d+$/.test(user.id)
        || user.unavailable || user.protected) throw new Error("x_profile_unavailable");
      const urls = [user.url, ...(user.profile_bio?.entities?.url?.urls ?? []).map((u: any) => u.expanded_url),
        ...(user.profile_bio?.entities?.description?.urls ?? []).map((u: any) => u.expanded_url)];
      const domains: string[] = [];
      for (const url of urls.slice(0, 30)) {
        if (typeof url !== "string" || !/^https?:\/\//.test(url)) continue;
        try { const parsed = watchInput(url); if (parsed.domain) domains.push(parsed.domain); } catch { /* no shortlink guessing */ }
      }
      return { handle, id: user.id, description: String(user.description ?? user.profile_bio?.description ?? "").slice(0, 4000), domains: [...new Set(domains)] };
    },
    async posts(handle) {
      const body = await read("last_tweets", handle);
      if (!Array.isArray(body.tweets)) throw new Error("x_invalid_posts");
      return body.tweets.slice(0, 20).filter((p: any) => typeof p.id === "string" && /^\d+$/.test(p.id)
        && typeof p.text === "string" && xHandle(p.author?.userName ?? "") === handle).map((p: any) => ({
        text: p.text.slice(0, 5000), url: `https://x.com/${handle}/status/${p.id}`,
        publishedAt: typeof p.createdAt === "string" && Number.isFinite(Date.parse(p.createdAt)) ? new Date(p.createdAt).toISOString() : null,
      }));
    },
  };
}
