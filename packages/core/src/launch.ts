import { identityAddress, identitySourceUrl, parseIdentityDeclaration } from "./identity.js";

export type LaunchDocument = { url: string; text: string; observedAt: string; kind: "website" | "profile" | "post" };
export type LaunchCandidate = { address: string; role: "deployer" | "token" | "factory" | "mention";
  sourceUrl: string; excerpt: string; observedAt: string; tokenDeclaration: boolean };
export type LaunchMatch = { tokenAddress: string; deployerAddress: string; creationTxHash: string;
  factory: string; blockNumber: number; basis: "token" | "deployer"; claimId: string | null };
export type LaunchReport = { version: 1; observedAt: string; domain: string | null; candidates: LaunchCandidate[];
  pagesChecked: string[]; gaps: string[]; matches: LaunchMatch[] };

/** Role labels are research hints. Even an explicit deployer label grants no issuer trust. */
export function launchCandidates(documents: LaunchDocument[], domain: string | null): LaunchCandidate[] {
  const result: LaunchCandidate[] = [];
  for (const doc of documents) {
    for (const match of doc.text.matchAll(/\b0x[a-fA-F0-9]{40}\b/g)) {
      let address: string; try { address = identityAddress(match[0]); } catch { continue; }
      const at = match.index!, before = doc.text.slice(Math.max(0, at - 80), at);
      const excerpt = doc.text.slice(Math.max(0, at - 100), at + 142).replace(/\s+/g, " ");
      const disclaimed = /\b(example|placeholder|fake|scam|not our|unofficial|deprecated|old|previous)\b/i.test(excerpt);
      const role = disclaimed ? "mention" : /\b(?:deployer|deployment wallet)(?:\s+address)?\s*[:=\-]?\s*["'`]?\s*$/i.test(before) ? "deployer"
        : /\bfactory(?:\s+(?:contract|address))?\s*[:=\-]?\s*["'`]?\s*$/i.test(before) ? "factory"
        : /\b(?:token\s*(?:contract\s*)?(?:address|contract)|contract\s*address|tokenAddress|CA)\s*[:=\-]?\s*["'`]?\s*$/i.test(before) ? "token" : "mention";
      let tokenDeclaration = false;
      if (domain && doc.kind === "website" && role === "token") {
        try { identitySourceUrl(doc.url, domain); tokenDeclaration = parseIdentityDeclaration(doc.text, address).status === "matched"; } catch { /* out of scope */ }
      }
      if (result.some(c => c.address === address && c.sourceUrl === doc.url && c.role === role)) continue;
      result.push({ address, role, sourceUrl: doc.url, excerpt, observedAt: doc.observedAt, tokenDeclaration });
      if (result.length >= 40) return result;
    }
  }
  return result;
}

export function freshLaunchCandidates(report: LaunchReport, now = Date.now()): LaunchCandidate[] {
  return report.candidates.filter(c => Number.isFinite(Date.parse(c.observedAt)) && now >= Date.parse(c.observedAt)
    && now - Date.parse(c.observedAt) <= 24 * 60 * 60_000);
}
