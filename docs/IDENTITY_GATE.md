# Token identity gate

This gate blocks new paper buys unless the exact project/token identity is verified against an owner-reviewed public source and independently collected deployment evidence. It never treats a score, name, ticker, logo, follow relationship, address mention, domain registration or subdomain as issuer verification. Live trading remains disabled. Existing holdings and paper sells are unaffected.

## Telegram workflow

1. Register/watch the intended project using `/watch @handle domain`. Registration is not source trust.
2. Research or Grok drafts an identity claim using `POST /identity/claims`: `projectHandle`, `tokenAddress`, `deployerAddress`, `creationTxHash`, and `sourceUrl`. Telegram also accepts `/identityclaim @handle TOKEN DEPLOYER TRANSACTION_HASH HTTPS_PAGE`. Inputs are immutable; corrections require a new claim.
3. The collector retrieves the specified public source and checks the deployment. `/identity @handle` and the research card's Token identity button show claims, sources, missing information, and conflicts.
4. Open a claim, choose Review official source, inspect its exact domain, address, creator, transaction, and quoted source text. Confirm only after independently checking the page belongs to the intended project and announces that exact token/chain. This separate review pins the displayed source content; it does not approve a trade or override chain checks. Only the Telegram owner, through the shared service credential, can perform it.
5. Draft paper proposals with the same `projectHandle` and exact token address. `/proposals` refreshes the latest five pending proposals. Approval appears only when the current gate passes; the API repeats the gate in the settlement transaction. Old approval buttons cannot bypass it.

Research/Grok can create drafts but cannot submit collector reports, set reviewed fields, or confirm official-source trust. No current project is automatically trusted on deployment. Establishing the initial trust anchor requires the user's source review; reciprocal links by themselves cannot distinguish a coordinated copycat website/account.

## Verification rules

- HTTPS source URL must be within the registered project domain, with no credentials, custom port or fragment. The collector uses pinned public IPv4 DNS resolution, TLS validation, bounded responses, and timeouts. Redirects to a different URL require a new claim. Documents on a separate domain require a separately designed trust mechanism; they are not silently accepted.
- The page must explicitly identify a **token address** and Robinhood Chain or chain ID 4663. Arbitrary addresses do not qualify. Different/multiple declared token addresses or chain IDs, and ambiguous/disclaimed declarations, block verification. The parser deliberately abstains on unsupported formats. JSON `tokenAddress`/`chainId` and simple labeled text are supported; JavaScript-rendered-only pages are not.
- The owner review pins a SHA-256 hash of the source URL and normalized complete page text. A changed source requires review again. Review confirmations expire after five minutes and recheck the current content hash. The source excerpt is untrusted evidence, never an instruction.
- On-chain checks independently read chain ID, successful receipt, transaction, canonical block hash, creator/token relationship, code before creation, code at creation, and code at a recent block. Creation/head block hashes are checked again after the code reads. At least 12 L2 block confirmations are required; this is **not a claim of L1 finality**.
- Supported deployment paths: direct contract creation, and the explicitly configured Pons V2 factory's `TokenLaunched` event with exact emitter/token/deployer and historical code checks. Arbitrary factory logs, pool creation, other factories, routed factory calls and unsupported archive queries remain unverified. An event from an unrelated emitter cannot prove identity.
- Website and deployment checks must be no more than five minutes old. Collector checks two oldest active claims per minute, only for projects whose monitoring is enabled; backlog can cause expiration, which blocks buys. Provider/archive errors fail closed. Evidence can change after the last observation; this bounded cache is not instantaneous detection.
- An X backlink is reported as an observation only. X account ownership and stable account-ID corroboration await the TwitterAPI.io adapter. A reviewed website plus canonical deployment can pass the current gate without claiming X authentication.

The Pons event layout was checked against the [official V2 event documentation](https://docs.ponsfamily.com/v2#events-to-index); the configured factory matches the [project repository](https://github.com/ponsdotdev/ponsfamily). RPC receipt, block and code reads follow the [Ethereum JSON-RPC documentation](https://ethereum.org/en/developers/docs/apis/json-rpc/). The gate does not audit the factory or token code, validate upgrades, guarantee source ownership, or establish liquidity/sellability.

## States and consistency

**Verified** means all active reviewed claims for the intended project agree on the proposed token, the current registered domain is unchanged, and fresh source/deployment checks match. **Unverified** covers missing trust, unsupported evidence, expired checks, changed content, unavailable providers and paused monitoring. **Conflicting evidence** covers differing token addresses, domains, chain declarations, creators or canonical deployment evidence. Revoke obsolete/conflicting claims explicitly; submitting a new claim does not silently overwrite a trusted claim.

Source reviews, revocations, collector report writes, and buy settlement share the same PostgreSQL advisory lock. Project rows are held against concurrent changes while evaluating approvals. The immutable buy fill and entry snapshot retain the identity verdict, project handle, source hash, source URL, deployment transaction and block hash used at approval. Replaying an already completed buy returns its old fill even after revocation; it never creates another position. There is no override-through-score or bypass button.

## Operations and limits

Apply migration `0010_identity_gate.sql` before enabling `IDENTITY_GATE_ENABLED=true` on API and collector. API requires `PAPER_LEDGER_ENABLED=true`; no in-memory approval fallback is allowed. Preserve all existing ledger state. No live keys or new provider credentials are needed for this release; RPC access must support historical code reads.

Tests cover the pure decision gate, source scope and declaration parsing, mocked direct/factory/RPC evidence, Telegram review separation and button limits, authorization, and isolated PostgreSQL review/content binding, conflicts, gate enforcement, immutable fill evidence, and idempotency. No claim should be marked trusted in production solely to make a deployment test pass.

Still needed for live eligibility: stronger automated source/account authentication, more verified launchpad adapters, contract/proxy/permission checks, actual executable quotes and sell simulations, realistic costs, trading policies and an isolated signer. “Verified” in this release is explicitly an identity-evidence result, not a legitimacy or investment rating.
