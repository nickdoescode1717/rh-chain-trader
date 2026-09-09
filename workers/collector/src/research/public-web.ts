import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { normalizePublicDomain } from "@rh/core";

export function normalizeDomain(raw: string): string {
  return normalizePublicDomain(raw);
}
export function publicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 88 && c === 99)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113));
}
export function withinDomain(host: string, root: string): boolean { return host === root || host.endsWith(`.${root}`); }
export type PublicPage = { url: string; status: number; contentType: string; text: string };

/** HTTPS only, pinned public IPv4 resolution, verified TLS, capped response and no implicit redirects. */
export async function readPublicPage(rawUrl: string, allowedRoot: string, redirects = 0): Promise<PublicPage> {
  const url = new URL(rawUrl);
  const host = normalizeDomain(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !withinDomain(host, allowedRoot)) throw new Error("url_outside_public_scope");
  const addresses = await lookup(host, { family: 4, all: true });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address))) throw new Error("non_public_dns_target");
  const result = await new Promise<PublicPage & { redirect?: string }>((resolve, reject) => {
    const req = request(url, { family: 4, method: "GET",
      headers: { "User-Agent": "RHResearch/0.1 (public evidence)", Accept: "text/html,application/json,text/plain" },
      lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4),
      signal: AbortSignal.timeout(12_000),
    }, (res) => {
      const status = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.resume(); resolve({ url: url.href, status, text: "", contentType: "", redirect: res.headers.location }); return;
      }
      const contentType = String(res.headers["content-type"] ?? "");
      if (!/text\/|application\/(json|xml)/i.test(contentType)) {
        res.resume(); resolve({ url: url.href, status, text: "", contentType }); return;
      }
      let size = 0; const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_000_000) { res.destroy(); reject(new Error("public_response_too_large")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ url: url.href, status, contentType, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", () => reject(new Error("public_response_failed")));
    });
    req.on("error", () => reject(new Error("public_request_failed"))); req.end();
  });
  if (result.redirect) {
    if (redirects >= 2) throw new Error("redirect_limit");
    return readPublicPage(new URL(result.redirect, url).href, allowedRoot, redirects + 1);
  }
  return result;
}
