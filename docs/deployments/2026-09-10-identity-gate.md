# Identity gate deployment — 2026-09-10 UTC

Application revision `87e5cb4c0cc8a08855dc8647bd5858dce9fe58ae` from `codex/telegram-primary-research` deployed to the existing Hetzner Compose project `deploy`. See [IDENTITY_GATE.md](../IDENTITY_GATE.md) for the user flow, exact verification rules and limits.

## Release and preservation

- Applied migration 0010 transactionally. API and collector use `IDENTITY_GATE_ENABLED=true`; API retains `PAPER_LEDGER_ENABLED=true`. Real trading and transaction submission remain disabled across services.
- Rebuilt API, collector and Telegram. PostgreSQL, API, collector and Telegram running with zero restarts at verification. Database and Telegram state volumes preserved.
- Root-only backup `/root/rh-deploy-backups/20260910T014842Z-identity`: previous environment/Compose/git revision/image tags and database dump, plus a fresh dump and book/project snapshot while Telegram was stopped immediately before cutover. Restore was not rehearsed.
- Exact account records and existing positions compared before/after: **0.88 ETH cash**, **3 open legacy positions**, no changes to size, entry snapshots, remaining quantity/cost or realized P&L. Fill history and project domain/monitoring settings preserved.
- `tradedotcv` remains paused, has no identity claim, and reports **Unverified — project monitoring paused**. No source trust was inferred from the user's earlier example or existing watch registration. No production claim, review, approval or trade was created for testing.

## Validation

- Local core 24, API 23, collector 23 and Telegram 28 tests passed: **98 total**. Relevant TypeScript builds and all three Docker builds passed.
- Isolated PostgreSQL test used a schema-only clone and synthetic records. Passed score/draft trust-bypass rejection, Telegram-only source review, content-bound review expiry/change checks, exact-token copycat rejection, changed domain, stale checks, noncanonical deployment conflicts, atomic gated buy and duplicate replay, immutable identity evidence in fills, conflicting claims, revocation and historical replay. Temporary database removed afterward; no user rows copied.
- Read-only real-chain probe validated token `0x85fc89831e4272ba08ea0d9689a3d2ecfc0041e0`, transaction `0xb8c719b996335eaf1a845dc08b00782b47acfd145bbb4a3813345c25e6b590a8`, Pons V2 event at block **59025607**, canonical block hash `0xa898d6a6abe3307c59d6a09026fcd1d436827fcf51de6bc30d34b81f678f7aa8`, and **105** observed L2 confirmations. This tested the deployment component only; it did not establish this token's official project identity or safety and did not create a production claim.
- An earlier real-chain probe revealed a routed factory call rejected by the initial direct-destination requirement. The verifier now authenticates the configured factory emitter and event inside the canonical receipt independently of `tx.to`, preserving creator/token and historical-code checks. Added regression checks for routed calls and forged emitters/deployers.
- Live API rejects unauthorized/Grok source review, confirmation and revocation with 403. Deployed Telegram code rendered the current project identity and checked **18 proposal cards**; unverified cards expose no Approve button. No Telegram test message sent. Actual owner review of a real official-source claim is still a user acceptance step.

## Remaining scope

Initial source trust requires the owner's independent Telegram review. X account authentication awaits TwitterAPI.io. The parser requires an explicit token/chain declaration on a public page and deliberately abstains on unsupported or ambiguous content. Deployment adapters currently cover direct creation and the configured Pons V2 event path; other factories remain unverified. Five-minute evidence freshness and 12 L2 confirmations do not provide instantaneous change detection or L1-finality guarantees. Contract safety, liquidity, sellability, trading policies and live execution remain separate work.
