import {waitForCollection} from "./collection-control.js";
import { createHash } from "node:crypto";
import { createDb, identityClaims, researchProjects } from "@rh/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { identitySourceUrl, parseIdentityDeclaration, PONS_V2_LAUNCH_FACTORY, PONS_V2_TOKEN_LAUNCHED, type IdentityReport } from "@rh/core";
import { readPublicPage } from "./research/public-web.js";
type Claim = { domain: string; projectHandle: string; sourceUrl: string; tokenAddress: string; deployerAddress: string; creationTxHash: string };
type Rpc = (method: string, params: unknown[]) => Promise<any>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const low = (v: unknown) => typeof v === "string" ? v.toLowerCase() : "";
const hexHash = (v: unknown) => typeof v === "string" && /^0x[a-fA-F0-9]{64}$/.test(v);
const blockNumber = (v: unknown) => typeof v === "string" && /^0x(?:0|[1-9a-f][a-f0-9]*)$/i.test(v) ? BigInt(v) : null;
export function createIdentityRpc(url = process.env.RPC_URL): Rpc {
  return async (method, params) => {
    if (!url) throw new Error("rpc_unavailable");
    const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (!response.ok || !response.body) throw new Error("rpc_unavailable");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 1_000_000) throw new Error("rpc_response_too_large"); chunks.push(r.value); } }
    finally { await reader.cancel().catch(() => {}); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (data.id !== 1 || data.error || !("result" in data)) throw new Error("rpc_unavailable");
    return data.result;
  };
}
export async function inspectIdentityChain(c: Claim, rpc: Rpc): Promise<IdentityReport["chain"]> {
  const missing = (reason: string): IdentityReport["chain"] => ({ status: "missing", reason });
  const conflict = (reason: string): IdentityReport["chain"] => ({ status: "conflicting", reason });
  if (blockNumber(await rpc("eth_chainId", [])) !== 4663n) return conflict("rpc_chain_mismatch");
  const receipt = await rpc("eth_getTransactionReceipt", [c.creationTxHash]);
  if (!receipt) return missing("deployment_receipt_pending");
  if (low(receipt.transactionHash) !== c.creationTxHash || !hexHash(receipt.blockHash)) return conflict("deployment_receipt_mismatch");
  if (receipt.status !== "0x1") return missing("deployment_transaction_unsuccessful");
  const height = blockNumber(receipt.blockNumber);
  if (height == null || height <= 0n) return missing("invalid_deployment_block");
  const [canonical, head, tx] = await Promise.all([
    rpc("eth_getBlockByNumber", [receipt.blockNumber, false]), rpc("eth_getBlockByNumber", ["latest", false]),
    rpc("eth_getTransactionByHash", [c.creationTxHash]),
  ]);
  if (!canonical || low(canonical.hash) !== low(receipt.blockHash) || blockNumber(canonical.number) !== height) return conflict("deployment_block_not_canonical");
  const tip = blockNumber(head?.number);
  if (tip == null || !hexHash(head?.hash) || tip < height || tip - height + 1n < 12n) return missing("deployment_needs_12_confirmations");
  if (!tx || low(tx.hash) !== c.creationTxHash || low(tx.blockHash) !== low(receipt.blockHash) || blockNumber(tx.blockNumber) !== height) return conflict("deployment_transaction_mismatch");
  let method: string;
  if (receipt.contractAddress != null) {
    if (low(receipt.contractAddress) !== c.tokenAddress || low(tx.from) !== c.deployerAddress || tx.to != null) return conflict("direct_creator_or_token_mismatch");
    method = "direct_contract_creation";
  } else {
    // Only this explicit ABI adapter is supported. Generic factory events and pool creation are insufficient.
    const emitter = PONS_V2_LAUNCH_FACTORY.toLowerCase();
    const addressWord = (value: unknown) => typeof value === "string" && /^0x0{24}[a-fA-F0-9]{40}$/.test(value) ? `0x${value.slice(-40).toLowerCase()}` : "";
    const factoryLogs = Array.isArray(receipt.logs) ? receipt.logs.filter((l: any) => low(l.address) === emitter && low(l.topics?.[0]) === PONS_V2_TOKEN_LAUNCHED) : [];
    if (!factoryLogs.length) return missing("unsupported_factory_creation_path");
    // A router/multisig may be tx.to. Only the actual emitter and canonical receipt establish the factory event.
    const logs = factoryLogs.filter((l:any) => addressWord(l.topics?.[1]) === c.tokenAddress);
    if (logs.length !== 1 || logs[0].removed === true || low(logs[0].blockHash) !== low(receipt.blockHash) ||
      low(logs[0].transactionHash) !== c.creationTxHash || logs[0].topics.length !== 4 || addressWord(logs[0].topics[3]) !== c.deployerAddress) return conflict("factory_token_or_deployer_mismatch");
    method = "pons_v2_token_launched";
  }
  const before = `0x${(height - 1n).toString(16)}`;
  const [priorCode, birthCode, currentCode, finalBlock, finalHead] = await Promise.all([
    rpc("eth_getCode", [c.tokenAddress, before]), rpc("eth_getCode", [c.tokenAddress, receipt.blockNumber]),
    rpc("eth_getCode", [c.tokenAddress, head.number]), rpc("eth_getBlockByNumber", [receipt.blockNumber, false]), rpc("eth_getBlockByNumber", [head.number, false]),
  ]);
  if (priorCode !== "0x") return conflict("token_existed_before_claimed_deployment");
  const code = (v: unknown) => typeof v === "string" && /^0x(?:[0-9a-fA-F]{2})+$/.test(v);
  if (!code(birthCode) || !code(currentCode)) return missing("token_contract_code_unavailable");
  if (low(finalBlock?.hash) !== low(receipt.blockHash) || low(finalHead?.hash) !== low(head.hash)) return conflict("chain_changed_during_verification");
  return { status: "matched", reason: "canonical_creation_token_and_deployer_match", blockNumber: String(height), blockHash: low(receipt.blockHash),
    confirmations: Number(tip - height + 1n), method };
}
export async function inspectIdentity(c: Claim, read = readPublicPage, rpc: Rpc = createIdentityRpc()): Promise<IdentityReport> {
  const sourceTask = async (): Promise<IdentityReport["source"]> => {
    const url = identitySourceUrl(c.sourceUrl, c.domain), page = await read(url, c.domain);
    if (page.status !== 200 || !/text\/(html|plain)|application\/json/i.test(page.contentType)) throw new Error("source_unavailable");
    if (page.url !== url) throw new Error("source_redirect_requires_new_claim");
    const text = page.text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&(?:nbsp|quot|amp|lt|gt);/gi, " ").replace(/\s+/g, " ").trim();
    const declaration = parseIdentityDeclaration(text, c.tokenAddress);
    const xLinked = new RegExp(`https://(?:www\\.)?(?:x\\.com|twitter\\.com)/${c.projectHandle}(?:[/?#"'\\s]|$)`, "i").test(page.text);
    const at = Math.max(0, text.toLowerCase().indexOf(c.tokenAddress) - 180);
    return { ...declaration, url, hash: hash(url + "\n" + text), excerpt: text.slice(at, at + 650), xLinked };
  };
  const [source, chain] = await Promise.allSettled([sourceTask(), inspectIdentityChain(c, rpc)]);
  return { version: 1,
    source: source.status === "fulfilled" ? source.value : { status: "unavailable", reason: "official_source_unavailable_or_redirected", url: c.sourceUrl, hash: null, excerpt: "", addresses: [], xLinked: false },
    chain: chain.status === "fulfilled" ? chain.value : { status: "unavailable", reason: "deployment_rpc_or_archive_unavailable" } };
}
export async function runIdentityLoop() {
  if (process.env.IDENTITY_GATE_ENABLED !== "true" || !process.env.DATABASE_URL) return;
  const db = createDb(process.env.DATABASE_URL);
  for (;;) {
    await waitForCollection(true);
    try {
      const rows = await db.select({ claim: identityClaims }).from(identityClaims)
        .innerJoin(researchProjects, eq(researchProjects.handle, identityClaims.projectHandle))
        .where(and(isNull(identityClaims.revokedAt), eq(researchProjects.enabled, true)))
        .orderBy(sql`${identityClaims.checkedAt} ASC NULLS FIRST`).limit(2);
      for (const { claim } of rows) {
        const started = new Date(), report = await inspectIdentity(claim);
        await db.transaction(async tx => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(4663, 9009)`);
          await tx.update(identityClaims).set({ report, checkedAt: started }).where(and(eq(identityClaims.id, claim.id), isNull(identityClaims.revokedAt)));
        });
      }
    } catch { console.warn("[identity] checks unavailable; stale evidence blocks approval"); }
    await new Promise(resolve => setTimeout(resolve, 60_000));
  }
}


