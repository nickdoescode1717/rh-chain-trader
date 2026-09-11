import { identitySourceUrl, launchCandidates, type LaunchDocument, type LaunchReport, type WatchDiscovery } from "@rh/core";
import { readPublicPage } from "./public-web.js";

const plain = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&(?:nbsp|amp|quot|apos);/g, " ").replace(/\s+/g, " ").slice(0, 150_000);

/** Reuses collected X data. Up to six additional linked public pages per hourly watch scan. */
export async function inspectLaunch(discovery: WatchDiscovery, documents: LaunchDocument[] = [], read = readPublicPage): Promise<LaunchReport> {
  const docs = [...documents], seen = new Set(docs.filter(d => d.kind === "website").map(d => d.url));
  const gaps = [...discovery.gaps], queue = discovery.links.map(l => l.url);
  let attempted = 0;
  if (discovery.domain) while (queue.length && attempted < 6) {
    const raw = queue.shift()!;
    let url: string; try { url = identitySourceUrl(raw, discovery.domain); } catch { continue; }
    if (seen.has(url)) continue;
    seen.add(url); attempted++;
    try {
      const page = await read(url, discovery.domain);
      if (page.status < 200 || page.status >= 300 || !/text\/|application\/json/i.test(page.contentType)) throw new Error("unavailable");
      docs.push({ url: page.url, text: page.text, kind: "website", observedAt: new Date().toISOString() });
      for (const match of page.text.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
        try {
          const link = new URL(match[1].replaceAll("&amp;", "&"), page.url); link.hash = ""; link.search = "";
          if (/(docs|token|contract|deploy|launch|address|whitepaper)/i.test(link.pathname + link.hostname) && queue.length < 30) queue.push(link.href);
        } catch { /* malformed public link */ }
      }
    } catch { gaps.push("launch_document_unavailable"); }
  }
  if (queue.length && attempted >= 6) gaps.push("launch_document_limit_reached");
  const candidates = launchCandidates(docs.map(d => ({ ...d, text: d.kind === "website" ? plain(d.text) : d.text })), discovery.domain);
  if (!candidates.some(c => c.role === "deployer")) gaps.push("explicit_deployer_not_found");
  if (!candidates.some(c => c.tokenDeclaration)) gaps.push("official_token_and_chain_declaration_missing");
  return { version: 1, observedAt: new Date().toISOString(), domain: discovery.domain, candidates,
    pagesChecked: docs.filter(d => d.kind === "website").map(d => d.url), gaps: [...new Set(gaps)], matches: [] };
}
