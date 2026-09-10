import { normalizePublicDomain } from "./research.js";
export const IDENTITY_MAX_AGE_MS = 5 * 60_000;
export type IdentityState = "verified" | "unverified" | "conflicting";
export type IdentityReport = {
  version: 1; source: { status: "matched" | "missing" | "conflicting" | "unavailable"; url: string; hash: string | null;
    excerpt: string; addresses: string[]; xLinked: boolean; reason: string };
  chain: { status: "matched" | "missing" | "conflicting" | "unavailable"; reason: string;
    blockNumber?: string; blockHash?: string; confirmations?: number; method?: string };
};
export type IdentityVerdict = { status: IdentityState; reasons: string[]; claimId: string | null; checkedAt: string | null;
  sourceUrl: string | null; deploymentTx: string | null; scope: string; sourceHash?: string | null; deploymentBlockHash?: string | null; projectHandle?: string | null };
export const identityScope = "Identity against owner-reviewed sources and deployment evidence only; not a safety, sellability or investment verdict.";
export function identitySourceUrl(raw: unknown, domain: string): string {
  if (typeof raw !== "string" || raw.length > 500) throw new Error("invalid_source_url");
  const u = new URL(raw), root = normalizePublicDomain(domain), host = normalizePublicDomain(u.hostname);
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash || !(host === root || host.endsWith(`.${root}`))) throw new Error("source_outside_project_domain");
  return u.href;
}
export function identityAddress(raw: unknown): string {
  if (typeof raw !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(raw) || /^0x0{40}$/i.test(raw)) throw new Error("invalid_identity_address");
  return raw.toLowerCase();
}
/** Deliberately narrow declaration parser: arbitrary address mentions never establish token role. */
export function parseIdentityDeclaration(text: string, expected: string) {
  const addressPattern = /\b(?:token\s*(?:contract\s*)?(?:address|contract)|contract\s*address|tokenAddress)\s*["']?\s*[:=\-]?\s*["'`]?\s*(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/gi;
  const addresses = [...new Set([...text.matchAll(addressPattern)].map(m => m[1].toLowerCase()))];
  const chainIds = [...new Set([...text.matchAll(/\bchain\s*(?:id|ID)\s*["']?\s*[:=\-]?\s*["']?\s*(\d+)\b/gi)].map(m => Number(m[1])))];
  const chainNamed = /\bRobinhood\s+Chain\b/i.test(text);
  const mentions = [...text.matchAll(addressPattern)];
  if (mentions.some(m => /\b(?:not\s+(?:our|the|official)|unofficial|fake\s+token|scam\s+token|example|placeholder|deprecated|do\s+not\s+buy|old\s+token|previous\s+token|factory\s+contract|router\s+contract)\b/i.test(text.slice(Math.max(0,(m.index??0)-90),(m.index??0)+m[0].length+90))))
    return {status:"conflicting" as const,addresses,reason:"source_declaration_ambiguous_or_disclaimed"};
  if (addresses.some(a => a !== expected.toLowerCase()) || chainIds.some(id => id !== 4663)) return { status: "conflicting" as const, addresses, reason: "source_declares_different_or_multiple_tokens_or_chains" };
  if (addresses.length !== 1 || (!chainNamed && !chainIds.includes(4663))) return { status: "missing" as const, addresses, reason: "explicit_token_address_and_chain_declaration_required" };
  return { status: "matched" as const, addresses, reason: "explicit_token_and_chain_match" };
}
export function evaluateIdentity(input: { projectHandle: string | null; tokenAddress: string; domain: string | null; enabled: boolean;
  claims: { id: string; domain: string; tokenAddress: string; sourceUrl: string; creationTxHash: string; reviewedAt: Date | string | null;
    revokedAt: Date | string | null; reviewedSourceHash: string | null; checkedAt: Date | string | null; report: IdentityReport | null }[] }, now = Date.now()): IdentityVerdict {
  const base: IdentityVerdict = { status: "unverified", reasons: [], claimId: null, checkedAt: null, sourceUrl: null, deploymentTx: null, scope: identityScope, projectHandle: input.projectHandle };
  if (!input.projectHandle || !input.domain) return { ...base, reasons: ["project_link_required"] };
  if (!input.enabled) return { ...base, reasons: ["project_monitoring_paused"] };
  const active = input.claims.filter(c => c.reviewedAt && !c.revokedAt);
  if (!active.length) return { ...base, reasons: ["official_source_review_required"] };
  if (new Set(active.map(c => c.tokenAddress)).size !== 1 || active.some(c => c.tokenAddress !== input.tokenAddress.toLowerCase())) return { ...base, status: "conflicting", reasons: ["token_differs_from_reviewed_project_identity"] };
  const relevant = active.filter(c => c.tokenAddress === input.tokenAddress.toLowerCase());
  // All active reviewed claims must agree and remain valid; a second claim cannot hide a revoked/changed source.
  for (const c of relevant) {
    const report = c.report, checked = c.checkedAt ? new Date(c.checkedAt).getTime() : NaN;
    const details = { ...base, claimId: c.id, checkedAt: Number.isFinite(checked) ? new Date(checked).toISOString() : null, sourceUrl: c.sourceUrl, deploymentTx: c.creationTxHash };
    if (c.domain !== input.domain) return { ...details, status: "conflicting", reasons: ["project_domain_changed_since_review"] };
    if (!report || report.version !== 1 || !Number.isFinite(checked) || now < checked || now - checked > IDENTITY_MAX_AGE_MS) return { ...details, reasons: ["fresh_identity_checks_required"] };
    if (report.source?.status === "conflicting" || report.chain?.status === "conflicting") return { ...details, status: "conflicting", reasons: [report.source.status === "conflicting" ? report.source.reason : report.chain.reason] };
    if (report.source?.status !== "matched" || report.chain?.status !== "matched") return { ...details, reasons: [report.source?.status !== "matched" ? report.source?.reason ?? "source_unavailable" : report.chain?.reason ?? "chain_unavailable"] };
    if (!c.reviewedSourceHash || report.source.hash !== c.reviewedSourceHash) return { ...details, reasons: ["source_changed_review_again"] };
  }
  const c = relevant[0];
  return { ...base, status: "verified", reasons: ["reviewed_official_declaration_and_canonical_deployment_match"], claimId: c.id,
    checkedAt: new Date(c.checkedAt!).toISOString(), sourceUrl: c.sourceUrl, deploymentTx: c.creationTxHash,
    sourceHash: c.reviewedSourceHash, deploymentBlockHash: c.report?.chain.blockHash ?? null };
}
