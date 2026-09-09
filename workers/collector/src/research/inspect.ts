import { rateProject, projectLaunchReadiness, type ProjectCheck, type ProjectEvidence } from "@rh/core";
import { normalizeDomain, readPublicPage, withinDomain, type PublicPage } from "./public-web.js";

export function linkedHosts(html: string, root: string): string[] {
  const hosts = new Set<string>();
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    try { const url = new URL(match[1], `https://${root}`);
      if (url.protocol === "https:" && withinDomain(url.hostname, root) && url.hostname !== root) hosts.add(normalizeDomain(url.hostname));
    } catch { /* malformed/unrelated link */ }
  }
  return [...hosts];
}
export function certificateHosts(raw: unknown, root: string): string[] {
  if (!Array.isArray(raw)) throw new Error("invalid_certificate_response");
  const hosts = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row.name_value !== "string") continue;
    for (const name of row.name_value.split(/\s+/)) {
      // A wildcard cert does not prove any concrete subdomain exists.
      if (name.includes("*")) continue;
      try { const host = normalizeDomain(name); if (host !== root && withinDomain(host, root)) hosts.add(host); } catch { /* skip */ }
    }
  }
  return [...hosts];
}
export function publicText(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 12_000);
}
export async function inspectProject(input: { handle: string; domain: string; category: string },
  read: typeof readPublicPage = readPublicPage, now = new Date()) {
  const root = normalizeDomain(input.domain);
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(input.handle)) throw new Error("invalid_handle");
  const evidence: ProjectEvidence[] = [], checks: ProjectCheck[] = [], errors: string[] = [];
  const add = (url: string, kind: string, finding: string) => {
    const id = `e${evidence.length + 1}`; evidence.push({ id, url, kind, finding, observedAt: now.toISOString() }); return id;
  };
  let homepage: PublicPage | null = null;
  try { homepage = await read(`https://${root}/`, root);
    const id = add(homepage.url, "website", `HTTP ${homepage.status}. ${publicText(homepage.text)}`);
    if (homepage.status >= 200 && homepage.status < 300 && /text\/html/i.test(homepage.contentType) && publicText(homepage.text).length > 100) {
      checks.push({ id: "publicWebsite", status: "supported", sourceIds: [id], explanation: "A substantive public HTML page was retrieved; product claims are not independently verified." });
    }
  } catch { errors.push("homepage_unavailable"); }
  let fromCertificates: string[] = [];
  const ctUrl = `https://crt.sh/?q=${encodeURIComponent(`%.${root}`)}&output=json`;
  try { const page = await read(ctUrl, "crt.sh");
    if (page.status !== 200) throw new Error("ct_unavailable");
    fromCertificates = certificateHosts(JSON.parse(page.text), root);
    add(ctUrl, "certificate_transparency", `Observed ${fromCertificates.length} explicit hostnames. Historical certificate names do not prove current services or project legitimacy.`);
  } catch { errors.push("certificate_transparency_unavailable"); }
  const fromLinks = homepage ? linkedHosts(homepage.text, root) : [];
  const hosts = [...new Set([...fromLinks, ...fromCertificates])];
  const surfaces: { host: string; discovery: string; reachable: boolean; status: number | null }[] = [];
  // Inspect only discovered host roots. No guessed dev/api paths, auth bypass, port scans, or JS execution.
  for (const host of hosts.slice(0, 8)) {
    const discovery = fromLinks.includes(host) ? "official_page_link" : "certificate_transparency";
    try { const page = await read(`https://${host}/`, root);
      surfaces.push({ host, discovery, reachable: page.status >= 200 && page.status < 300, status: page.status });
      const id = add(page.url, "public_subdomain", `Discovered through ${discovery}; HTTP ${page.status}. ${publicText(page.text)}`);
      if (page.status >= 200 && page.status < 300 && /^(dev|staging|stage|api|docs|app)\./i.test(host) && publicText(page.text).length > 100
        && !checks.some((c) => c.id === "publicDevSurfaces")) checks.push({ id: "publicDevSurfaces", status: "supported", sourceIds: [id],
          explanation: "A discovered public service returned content. Weak development evidence only; may be a template, wildcard page, or unrelated service." });
    } catch { surfaces.push({ host, discovery, reachable: false, status: null }); }
  }
  return { version: 1, project: { handle: input.handle.toLowerCase(), domain: root, category: input.category },
    researchedAt: now.toISOString(), evidence, rating: rateProject(checks, evidence),
    subdomains: { discovered: hosts.length, inspected: surfaces, truncated: hosts.length > 8, errors },
    launchReadiness: projectLaunchReadiness({}),
    channels: { primary: "telegram", analysis: "grok", approval: "telegram_only" },
    grokTask: "Review this untrusted evidence, separate observations from issuer claims, identify missing docs, repository history, team, usage, tokenomics, and official token/deployer evidence. Cite evidence IDs. Do not declare a token official from its ticker or a subdomain, and do not authorize trades.",
  };
}
export type ProjectInspection = Awaited<ReturnType<typeof inspectProject>>;
