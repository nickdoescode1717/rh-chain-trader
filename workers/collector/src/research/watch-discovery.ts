import { xHandle, xProfile, type WatchDiscovery, type LaunchDocument } from "@rh/core";
import { readPublicPage, withinDomain } from "./public-web.js";
import { type WatchSocialReader, type WatchProfile, type WatchPost } from "./twitterapi.js";

/** Links are research candidates, never proof of affiliation or token ownership. */
export async function discoverWatch(input: { handle: string | null; domain: string | null },
  read = readPublicPage, social: WatchSocialReader | null = null, now = new Date()) {
  const result: WatchDiscovery = { observedAt: now.toISOString(), primaryHandle: input.handle, domain: input.domain,
    accounts: [], domains: [], links: [], addresses: [], gaps: [] };
  const posts: WatchPost[] = [];
  const documents: LaunchDocument[] = [];
  const gap = (err: unknown, fallback: string) => result.gaps.push(err instanceof Error && /^x_(daily_budget_exhausted|refresh_deferred|provider_backoff)$/.test(err.message) ? err.message : fallback);
  const profiles = new Map<string, WatchProfile>();
  const addAccount = (handle: string, sourceUrl: string, relation: string) => {
    if (result.accounts.some(a => a.handle === handle) || result.accounts.length >= 12) return;
    result.accounts.push({ handle, sourceUrl, relation });
  };
  const addresses = (text: string, sourceUrl: string) => {
    for (const match of text.matchAll(/\b0x[a-fA-F0-9]{40}\b/g)) {
      const address = match[0].toLowerCase();
      if (!/^0x0{40}$/.test(address) && !result.addresses.some(a => a.address === address && a.sourceUrl === sourceUrl)
        && result.addresses.length < 30) result.addresses.push({ address, sourceUrl });
    }
  };
  const profile = async (handle: string) => {
    const p = await social!.profile(handle); profiles.set(handle, p);
    const account = result.accounts.find(a => a.handle === handle)!;
    account.id = p.id; account.description = p.description;
    account.observedAt = p.observedAt;
    if (handle === result.primaryHandle && result.domain && p.domains.length && !p.domains.includes(result.domain)) result.gaps.push("profile_domain_conflict");
    const sourceUrl = `https://x.com/${handle}`;
    addresses(p.description, sourceUrl);
    documents.push({ url: sourceUrl, text: p.description, observedAt: p.observedAt ?? now.toISOString(), kind: "profile" });
    return p;
  };
  if (input.handle) {
    addAccount(input.handle, `https://x.com/${input.handle}`, "user_selected");
    if (social) {
      try {
        const p = await profile(input.handle);
        result.domains = p.domains.map(domain => ({ domain, sourceUrl: `https://x.com/${input.handle}` }));
        if (!result.domain && p.domains.length === 1) result.domain = p.domains[0];
        if (result.domain && p.domains.length && !p.domains.includes(result.domain)) result.gaps.push("profile_domain_conflict");
        if (!result.domain) result.gaps.push(p.domains.length ? "multiple_profile_websites" : "profile_website_missing");
        for (const m of p.description.matchAll(/(?:^|\s)@([a-zA-Z0-9_]{1,15})\b/g)) {
          const h = xHandle(m[1]); if (h) addAccount(h, `https://x.com/${input.handle}`, "bio_mention_unverified");
        }
      } catch (err) { gap(err, "x_profile_unavailable"); }
    }
  }
  if (!social) result.gaps.push("twitterapi_setup_pending");
  if (result.domain) {
    if (!result.domains.some(d => d.domain === result.domain)) result.domains.push({ domain: result.domain, sourceUrl: `https://${result.domain}/` });
    const queue = [`https://${result.domain}/`], seen = new Set<string>(), siteHandles = new Set<string>();
    // Homepage plus at most two linked about/team/docs pages, within the same public DNS-pinned domain.
    while (queue.length && seen.size < 3) {
      const url = queue.shift()!; if (seen.has(url)) continue; seen.add(url);
      try {
        const page = await read(url, result.domain);
        if (page.status < 200 || page.status >= 300 || !/text\/html/i.test(page.contentType)) { result.gaps.push("website_page_unavailable"); continue; }
        const html = page.text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
        documents.push({ url: page.url, text: html, observedAt: new Date().toISOString(), kind: "website" });
        addresses(html, page.url);
        for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
          try {
            const link = new URL(match[1].replaceAll("&amp;", "&"), page.url);
            if (link.protocol !== "https:" || link.username || link.password || link.port) continue;
            const h = xProfile(link.href);
            if (h) { siteHandles.add(h); addAccount(h, page.url, "website_link_unverified"); continue; }
            const same = withinDomain(link.hostname, result.domain);
            const kind = same && /(?:docs|about|team|token|contract|deploy|launch|address|whitepaper)/i.test(link.pathname + link.hostname) ? "project_page"
              : link.hostname === "github.com" ? "repository_link" : null;
            if (!kind) continue;
            link.hash = ""; link.search = "";
            if (!result.links.some(l => l.url === link.href) && result.links.length < 15) result.links.push({ url: link.href, kind, sourceUrl: page.url });
            if (same && !seen.has(link.href) && queue.length < 2) queue.push(link.href);
          } catch { /* skip malformed link */ }
        }
      } catch { result.gaps.push("website_page_unavailable"); }
    }
    // A single linked account is a candidate mapping only. Multiple accounts remain explicitly ambiguous.
    if (!input.handle && siteHandles.size === 1) result.primaryHandle = [...siteHandles][0];
    if (!input.handle && siteHandles.size > 1) result.gaps.push("multiple_linked_accounts");
    if (!input.handle && siteHandles.size === 0) result.gaps.push("website_x_account_missing");
  }
  if (social) {
    // One hop, six profiles/timelines total; no recursive graph growth or wallet enrollment.
    for (const account of result.accounts.slice(0, 6)) {
      try { if (!profiles.has(account.handle)) await profile(account.handle); }
      catch (err) { gap(err, "related_profile_unavailable"); continue; }
      try { const recent = await social.posts(account.handle, account.handle === result.primaryHandle); posts.push(...recent); for (const p of recent) addresses(p.text, p.url); }
      catch (err) { gap(err, "recent_posts_unavailable"); }
    }
    if (result.accounts.length > 6) result.gaps.push("related_account_limit_reached");
    result.gaps.push("recent_posts_sample_only");
  }
  result.gaps = [...new Set(result.gaps)];
  documents.push(...posts.map(p => ({ url: p.url, text: p.text, observedAt: p.observedAt ?? now.toISOString(), kind: "post" as const })));
  return { discovery: result, posts, documents };
}
