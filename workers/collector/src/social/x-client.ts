export type XUser = {
  id: string; username: string; description?: string;
  public_metrics?: Record<string, number>;
};
export type XPost = {
  id: string; text: string; created_at?: string;
  public_metrics?: Record<string, number>;
  entities?: { urls?: { expanded_url?: string }[] };
  note_post?: { text?: string };
};
export type XPage<T> = { data: T[]; nextToken?: string };
export interface XReader {
  user(handle: string): Promise<XUser>;
  userById(userId: string): Promise<XUser>;
  posts(userId: string, sinceId?: string, nextToken?: string): Promise<XPage<XPost>>;
  graph(userId: string, kind: "following" | "followers", nextToken?: string): Promise<XPage<XUser>>;
}

export class XReadError extends Error {
  constructor(public code: string, public retryAt = 0) { super(code); }
}

/** Only public read endpoints on the fixed X host. Never logs credentials or response bodies. */
export function createXReader(token: string, fetcher: typeof fetch = fetch): XReader {
  async function read(path: string, params: Record<string, string | undefined>) {
    const url = new URL(`https://api.x.com/2/${path}`);
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
    } catch { throw new XReadError("x_network_error"); }
    if (!response.ok) {
      const reset = Number(response.headers.get("x-rate-limit-reset")) * 1000;
      const retrySeconds = Number(response.headers.get("retry-after"));
      throw new XReadError(`x_http_${response.status}`, response.status === 429
        ? Math.max(Date.now() + 60_000, Number.isFinite(reset) ? reset : 0,
          Number.isFinite(retrySeconds) ? Date.now() + retrySeconds * 1000 : 0) : 0);
    }
    let body: any;
    try { body = await response.json(); } catch { throw new XReadError("x_invalid_json"); }
    if (!body || typeof body !== "object" || body.errors?.length) throw new XReadError("x_partial_or_invalid_response");
    return body;
  }
  function page<T>(body: any): XPage<T> {
    // An empty successful timeline has result_count=0 and may omit data.
    if (!Array.isArray(body.data) && !(body.data === undefined && body.meta?.result_count === 0)) {
      throw new XReadError("x_invalid_page");
    }
    if (body.meta?.next_token !== undefined && typeof body.meta.next_token !== "string") throw new XReadError("x_invalid_page");
    return { data: body.data ?? [], nextToken: body.meta?.next_token };
  }
  return {
    async user(handle) {
      const body = await read(`users/by/username/${encodeURIComponent(handle)}`, {
        "user.fields": "description,public_metrics",
      });
      if (!body.data || !/^\d+$/.test(body.data.id) || typeof body.data.username !== "string") throw new XReadError("x_invalid_user");
      return body.data as XUser;
    },
    async posts(userId, sinceId, nextToken) {
      return page<XPost>(await read(`users/${encodeURIComponent(userId)}/tweets`, {
        max_results: "100", since_id: sinceId, pagination_token: nextToken,
        "post.fields": "created_at,entities,public_metrics,note_post", exclude: "retweets",
      }));
    },
    async userById(userId) {
      const body = await read(`users/${encodeURIComponent(userId)}`, { "user.fields": "description,public_metrics" });
      if (!body.data || body.data.id !== userId || typeof body.data.username !== "string") throw new XReadError("x_invalid_user");
      return body.data as XUser;
    },
    async graph(userId, kind, nextToken) {
      return page<XUser>(await read(`users/${encodeURIComponent(userId)}/${kind}`, {
        max_results: "100", pagination_token: nextToken, "user.fields": "description,public_metrics",
      }));
    },
  };
}
