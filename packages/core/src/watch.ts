import { normalizePublicDomain } from "./research.js";

const reserved = new Set(["home", "intent", "share", "search", "explore", "i", "settings", "messages", "notifications", "login", "signup"]);
export function xHandle(raw: string): string | null {
  const handle = raw.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) && !reserved.has(handle) ? handle : null;
}
export function xProfile(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port
      || !/^(www\.|mobile\.)?(x\.com|twitter\.com)$/.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? xHandle(parts[0]) : null;
  } catch { return null; }
}
export function watchInput(raw: string): { key: string; handle: string | null; domain: string | null } {
  if (!raw || raw.length > 2048 || /[\s\\\u0000-\u001f]/.test(raw)) throw new Error("invalid_watch_input");
  const handle = xHandle(raw);
  if (handle) return { key: `x:${handle}`, handle, domain: null };
  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) throw new Error("invalid_watch_input");
  const profile = xProfile(url.href);
  if (profile) return { key: `x:${profile}`, handle: profile, domain: null };
  if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(url.hostname)) throw new Error("use_x_profile_link");
  // A watch targets the hostname, not arbitrary supplied paths or query strings.
  const domain = normalizePublicDomain(url.hostname);
  return { key: `site:${domain}`, handle: null, domain };
}

export type WatchDiscovery = {
  observedAt: string; primaryHandle: string | null; domain: string | null;
  accounts: { handle: string; sourceUrl: string; relation: string; description?: string; id?: string; observedAt?: string }[];
  domains: { domain: string; sourceUrl: string }[];
  links: { url: string; kind: string; sourceUrl: string }[];
  addresses: { address: string; sourceUrl: string }[];
  gaps: string[];
};
