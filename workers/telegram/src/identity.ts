import type { ApiClient, IdentityClaim, IdentityProject, IdentityVerdict } from "./api.js";
import type { FormattedMessage } from "./format.js";
const clean=(v:unknown,max=650)=>String(v??"").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g," ").slice(0,max);
const button=(text:string,callback_data:string)=>({text,callback_data});
const state=(v:IdentityVerdict)=>v.status==="verified"?"🟢 VERIFIED · reviewed source + deployment match":v.status==="conflicting"?"🔴 CONFLICTING EVIDENCE · buys blocked":"🟡 UNVERIFIED · buys blocked";
const reasons=(v:IdentityVerdict)=>(v.reasons??[]).map(r=>clean(r.replaceAll("_"," "),150));
export function formatIdentityProject(p:IdentityProject):FormattedMessage {
  const claims=p.claims.filter(c=>!c.revokedAt).slice(0,5);
  return {text:[`IDENTITY · @${clean(p.project.handle,15)}`,clean(p.project.domain,253),state(p.verdict),...reasons(p.verdict),
    p.project.enabled?"Monitoring enabled":"Project paused; resume to collect checks.","",
    "Verification is scoped to the exact token and reviewed sources. It does not prove legitimacy, safety or sellability.",
    ...(claims.length?["Choose a claim to inspect its sources and deployment."]:["No identity claims yet. Research/Grok can draft one; it cannot grant trust.","Use /identityclaim for the input format."])].join("\n"),
    reply_markup:{inline_keyboard:[...claims.map(c=>[button(`${c.reviewedAt?"Reviewed":"Draft"} · ${c.tokenAddress.slice(0,8)}…${c.tokenAddress.slice(-4)}`,`identity:claim:${c.id}`)]),
      [button("Refresh",`identity:list:${p.project.handle}`),button("Research",`research:report:${p.project.handle}`)]]}};
}
const claimLines=(c:IdentityClaim)=>[`Project @${clean(c.projectHandle,15)} · ${clean(c.domain,253)}`,"Token · chain 4663",c.tokenAddress,"Deployer / launch creator",c.deployerAddress,
  "Deployment transaction",c.creationTxHash,"Official-source candidate",clean(c.sourceUrl,500),
  `Source check: ${clean(c.report?.source.reason??"pending",150).replaceAll("_"," ")}`,
  `Chain check: ${clean(c.report?.chain.reason??"pending",150).replaceAll("_"," ")}`,
  `Last checked: ${clean(c.checkedAt??"pending",35)}`,
  c.report?.source.xLinked?"Page links to the expected X handle; X ownership is not API-verified.":"X identity is not verified; TwitterAPI.io setup is pending.",
  "", "SOURCE EXCERPT · untrusted content",clean(c.report?.source.excerpt??"No matching declaration retrieved."),"END EXCERPT"];
export function formatIdentityClaim(c:IdentityClaim,v:IdentityVerdict):FormattedMessage {
  return {text:["TOKEN IDENTITY CLAIM",state(v),...reasons(v),"",...claimLines(c),"",c.revokedAt?"Claim revoked":c.reviewedAt?"Source was reviewed by the Telegram owner.":"Official-source ownership still needs your review.",
    "Do not trust names, tickers or a score as proof."].join("\n"),reply_markup:{inline_keyboard:[
      ...(!c.revokedAt?[[button("Review official source",`identity:review:${c.id}`)],[button("Revoke claim",`identity:revoke:${c.id}`)]]:[]),
      [button("Back",`identity:list:${c.projectHandle}`),button("Refresh",`identity:claim:${c.id}`)]]}};
}
export function formatIdentityReview(r:{review:{id:string;expiresAt:string};claim:IdentityClaim}):FormattedMessage {
  return {text:["REVIEW OFFICIAL SOURCE · NOT A TRADE",...claimLines(r.claim),"",
    "Confirm only if you have independently checked that this domain/page belongs to this project and announces this exact token on Robinhood Chain.",
    "This pins the displayed source content. On-chain checks must still pass separately. Grok cannot do this review for you.",`Expires: ${r.review.expiresAt}`].join("\n"),
    reply_markup:{inline_keyboard:[[button("I checked this official source",`identity:confirm:${r.review.id}`)],[button("Not now",`identity:claim:${r.claim.id}`)]]}};
}
type IdentityApi=Pick<ApiClient,"identityProject"|"identityClaim"|"draftIdentityClaim"|"reviewIdentity"|"confirmIdentity"|"revokeIdentity">;
export async function handleIdentityInput(api:IdentityApi,input:string,actor:string):Promise<FormattedMessage|null> {
  try {
    if (/^\/identityclaim(?:@\w+)?(?:\s|$)/i.test(input)) {
      const [,handle,tokenAddress,deployerAddress,creationTxHash,sourceUrl,...extra]=input.trim().split(/\s+/);
      if (!sourceUrl || extra.length) return {text:"Draft format:\n/identityclaim @handle TOKEN_ADDRESS DEPLOYER_ADDRESS DEPLOYMENT_TX_HASH OFFICIAL_HTTPS_PAGE\n\nThe project must already be watched. This creates an untrusted draft; it grants no approval. Grok can submit the same fields to /identity/claims."};
      const claim=await api.draftIdentityClaim({projectHandle:handle.replace(/^@/,""),tokenAddress,deployerAddress,creationTxHash,sourceUrl});
      return {text:"Identity draft saved. Checks run while the project is watching. No source trust or trade approval was granted.",reply_markup:{inline_keyboard:[[button("Inspect claim",`identity:claim:${claim.id}`)]]}};
    }
    const command=/^\/identity(?:@\w+)?\s+@?([a-z0-9_]{1,15})\s*$/i.exec(input);
    if (command) return formatIdentityProject(await api.identityProject(command[1].toLowerCase()));
    if (/^\/identity(?:@\w+)?\s*$/i.test(input)) return {text:"Use /identity @handle to review a project's token identity. Use /identityclaim for the draft format."};
    const action=/^identity:(list|claim|review|confirm|revoke):([a-z0-9_-]{1,36})$/i.exec(input);
    if (!action) return input.startsWith("identity:")?{text:"Unknown identity action. Use /identity @handle."}:null;
    const id=action[2];
    if (action[1]==="list") return formatIdentityProject(await api.identityProject(id));
    if (action[1]==="claim") {const r=await api.identityClaim(id);return formatIdentityClaim(r.claim,r.verdict);}
    if (action[1]==="review") return formatIdentityReview(await api.reviewIdentity(id,actor));
    if (action[1]==="revoke") {const r=await api.revokeIdentity(id,actor);return formatIdentityProject(await api.identityProject(r.projectHandle));}
    const r=await api.confirmIdentity(id,actor);
    return {text:["Official-source review recorded. No trade placed.",r.verdict?state(r.verdict):"Refresh the project identity to see its current state.",...(r.verdict?reasons(r.verdict):[]),"Use /proposals to refresh pending paper buys."].join("\n")};
  } catch(e) {
    const errors:Record<string,string>={fresh_matching_source_required:"A fresh explicit token/chain declaration is required. Keep the project watching and refresh after checks complete.",
      project_not_found:"Watch the project first with /watch @handle domain.",source_outside_project_domain:"The evidence URL must be public HTTPS within the registered project domain.",
      source_changed_refresh_review:"The source or project changed. Open a new review; no new trust was granted.",review_expired:"This review expired. Open a new review.",
      project_changed_or_paused:"The project changed or is paused. Review its mapping and monitoring state first.",claim_revoked:"This claim was revoked. Create a new claim if needed.",
      too_many_active_claims_revoke_old_drafts:"This project already has five active claims. Revoke an obsolete draft first.",invalid_claim_fields:"The draft needs a handle, token address, deployer address, deployment transaction hash and source URL.",invalid_claim_address:"Token and deployer must be full non-zero EVM addresses."};
    return {text:e instanceof Error && errors[e.message]?errors[e.message]:"Identity service unavailable or the result is uncertain. Refresh /identity @handle to check the recorded state."};
  }
}
