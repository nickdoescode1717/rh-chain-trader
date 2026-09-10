import { reserveXRequest, finishXRequest, type Db } from "@rh/db";
import type { WatchSocialReader, WatchProfile, WatchPost } from "./twitterapi.js";

export function budgetedXReader(db: Db, provider: WatchSocialReader): WatchSocialReader {
  async function read<T>(kind: "profile" | "posts", handle: string, age: number, request: () => Promise<T>): Promise<T> {
    const reserved = await reserveXRequest(db, kind, handle, age);
    if (reserved.cached !== null) return reserved.cached as T;
    try {
      const result = await request(), observedAt = new Date().toISOString();
      const stamped = kind === "profile" ? { ...result, observedAt } : (result as WatchPost[]).map(p => ({ ...p, observedAt }));
      await finishXRequest(db, reserved.id!, stamped);
      return stamped as T;
    } catch (err) {
      await finishXRequest(db, reserved.id!, null, err instanceof Error && /^x_http_(401|402|403|429)$/.test(err.message));
      throw err;
    }
  }
  return {
    profile: handle => read<WatchProfile>("profile", handle, 86_400_000, () => provider.profile(handle)),
    posts: (handle, priority = false) => read<WatchPost[]>("posts", handle, priority ? 3_600_000 : 21_600_000, () => provider.posts(handle)),
  };
}
