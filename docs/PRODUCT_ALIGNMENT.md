# Product requirements and implementation alignment

Updated 2026-09-09. This is the requirements checklist derived from Nick's original idea, the structured Grok prompt in the conversation, and his later request for X/follow-graph monitoring and automatic token-launch buys. Use it when planning changes; do not narrow the product to a token table or describe an unimplemented feature as complete.

## Intended product

**Primary interface and sole trade-approval channel: the existing Telegram bot.** Nick explicitly prefers concise options and reports inside Telegram, not a full-scale polished application. Keep the backend capable and efficient; prioritize relevant alerts, simple buttons, dependable collection and execution controls over frontend expansion. Grok remains backend research/analysis and proposal drafting, with no approval authority. Existing web pages are optional operator tools.

Find promising new platforms and tokens early in the Robinhood Chain ecosystem. Monitor selected and newly discovered launchpads/protocols, their X activity and relationships, public development evidence, and a curated trader-wallet list. Link platform identity to verified contracts/deployers, investigate the opportunity, distinguish meme from utility tokens, and generate source-backed reports. Move from research to validated paper execution and then policy-controlled live entry and exits.

Robinhood brokerage listings are not evidence of deployment on the target chain. Chain IDs, endpoints, factory addresses, token ownership, and time-sensitive ecosystem claims must be verified against current primary sources/on-chain reads before live use. The repository currently configures chain 4663; historical Markdown claims are not independent verification.

## Reconcile the original and latest instructions

- Nick selected **TwitterAPI.io** for X scanning on 2026-09-09 and explicitly deferred setup. The older official X graph scanner still needs a vendor adapter. One-input watches now have a separate bounded TwitterAPI.io profile/recent-post adapter; live credential validation remains pending. Preserve the Grok analysis/bot interfaces; do not configure credentials or enable paid collection now.
- Nick subsequently made **Telegram primary and the only trade-approval interface**. This supersedes earlier Grok-primary/Telegram-fallback language. Grok keeps analysis and proposal drafting, not approval authority. Future automatic policies must be authorized through Telegram; an LLM never authorizes itself.
- Nick emphasized **copycat avoidance as critical**. Future live eligibility requires chain-specific official issuer/token/deployer provenance. Name/ticker/logo matches, subdomain evidence, follower links, an address mention or a model score cannot establish identity. Conflicting or missing issuer evidence must block execution. The deployed paper identity gate now requires an owner-reviewed explicit source declaration plus fresh canonical direct/Pons V2 deployment evidence. X authentication and additional deployment adapters remain missing; identity verification is not a safety verdict.
- The original structured prompt starts with explicit approval for each buy and allows sells under rules approved in advance.
- Nick subsequently requested automatic purchases when monitored platforms launch tokens. Automatic buying is now a target feature, with an optional manual-approval mode, not permanently out of scope.
- Automatic buying means a previously configured policy authorizes a verified trigger within limits. An X post, a following change, an LLM score, or a newly found address cannot change that policy.
- Nick supplied `@tradedotcv` as the first platform example; migration 0007 registers it with the candidate domain `trade.cv`. The broader account/platform and wallet lists, paper/live mode, per-token limit, daily spend/exposure limits, acceptable slippage/launch conditions, and exit rules remain unresolved. Do not invent those values or activate live execution from this checklist.
- The original 50-wallet idea is an infrastructure question, not an instruction to fund wallets now. Wallets must not be split to evade launch taxes, per-wallet limits, or allowlists. A proposed 5% supply position must be assessed against liquidity and concentration; it is not a default sizing rule. A reported 4x return is not a test expectation or promise.

## Requirements matrix

Statuses describe code on the working PR branches, not a verified deployment.

| Requirement | Code status | Next acceptance condition |
|---|---|---|
| Telegram as the main interface; efficient and selective notifications | Implemented, unverified live: project commands/buttons, compact reports, persistent research-alert deduplication, owner checks and non-overlapping polling | Deploy into the existing bot and verify commands, callbacks, report delivery and restart recovery; no new dashboard requirement |
| Track existing/new launchpads and other protocols, including lending applications | Partial: protocol registry and fixed Pons/pools.trade collectors | Discover/update registry from primary sources; support configurable, verified adapters rather than claiming comprehensive coverage |
| Read official docs, public repositories, audits, and smart contracts | Partial: opt-in homepage/public subdomain evidence pipeline and optional Grok narrative; deeper docs/repo/contract inspection missing | Timestamped substantive sources, summaries, contradictions/unknowns, and reproducible contract evidence per project |
| Scan X posts and profile/bio changes for monitored accounts | Implemented, unverified live: opt-in official API scanner | Authenticate with funded access; verify real responses, timestamps, paging and restart behavior |
| Watch following/follower changes, inspect related profiles and then interesting accounts' posts | Partial: completed-snapshot differences and related bio addresses; explicit account registration | Bounded related-account discovery and relevance review; public metrics growth/bot-quality analysis; do not label baseline follows as new |
| Broad chatter/search and hourly research, with faster launch monitoring | Partial: selected-account polling plus existing RPC polling | Keyword/mention/search coverage, measured freshness and backlogs, streaming/event scheduling where supported; no guaranteed first-50 transaction claim |
| Find token, factory, and deployer addresses; trace provenance/funding/history | Partial: deployed paper identity gate, owner-reviewed source hash, direct/Pons V2 canonical creation/deployer checks, stale/conflict rejection | Automate stronger official-account authentication; add verified factory adapters, deployer history and funding links; no ownership inference from a tweet |
| Smart-contract and launch risk review | Partial: simple supplied-input risk heuristics; factory bytecode-presence checks | Inspect permissions, proxies, mint/pause/blacklist, taxes/limits, holders, liquidity and executable buy/sell simulations; critical rejection gates |
| Public development/subdomain research | Partial: passive linked/certificate host discovery, bounded public HTTPS reads, coverage errors, and ten-category project evidence rubric | Validate live source coverage and substantive dev/docs/release/usage signals; host existence alone contributes at most 5/100 |
| Monitor approximately 400 curated trader wallets | Partial: wallet registry and inbound ERC-20 transfer poller | Import the actual list; distinguish swaps/buys/sells from transfers/mints/airdrops, measure realized returns, account for related wallets, costs and survivorship bias |
| Filter by market cap, liquidity, token age and category | Mostly missing: WATCH_* filters are documented no-ops | Trusted timestamped price/supply/liquidity inputs; enforce filters or explicitly abstain when unavailable |
| Separate meme and utility scores, plus risk and evidence confidence | Partial: distinct scoring functions, not integrated with comprehensive research | Meme traction/narrative/bot-quality inputs; utility product/usage/value-capture/FDV/unlocks/competition inputs; no invented missing values or automatic investment verdict from a social flag |
| Report and rank opportunities with source links and time | Partial: persisted project snapshots, evidence/coverage/rubric UI, optional Grok narrative and compatible research handoff; overall rating withheld when insufficient evidence | Integrate substantive category-specific research and market-cap context; current automatic project checks cover at most 10/100 points and do not yield a legitimacy verdict |
| Automatic entry under approved policy, plus manual approval option | Missing live/policy engine: paper manual proposals and isolated-signer stub exist | Versioned immutable policy, verified triggers/quotes, durable spend reservations, duplicate prevention, expiry/revalidation, signer isolation and paper validation |
| Automated exits under preapproved rules | Missing automated policies; manual Telegram paper partial/full sells and durable realized P&L implemented | Tested take-profit/stop/trailing/time/emergency exits; acknowledge failed exits, monitor liquidity, enforce exposure/daily-loss limits and kill switch |
| Wallet custody/operational infrastructure | Partial public address registry; no actual signer | Choose a supported account/key model, nonce and funding management, scoped signing permissions; secrets never enter research or LLM context |
| Tests, paper trading and phased deployment | Partial: durable paper ledger deployed; local tests and isolated PostgreSQL concurrency, rollback and process-restart validation passed | On-chain/provider integration, execution realism, reorg/failed-transaction tests and cost-aware historical/live paper evaluation before live activation |

## Ten public development signals to research

1. Documentation history and specificity.
2. Public repository history and substantive commits.
3. Releases/changelogs matching shipped features.
4. Public issue/PR resolution and contributor continuity.
5. Public subdomains linked from official sources or passive records.
6. Public development/staging pages with consistent product behavior.
7. Public API documentation and usable read-only examples.
8. Tests/build evidence and dependency maintenance.
9. Contracts matching the documented product, upgrades, and audits.
10. Observable product usage and credible delivery against prior announcements.

Each can be fabricated or misinterpreted. A dev/staging/API route is supporting evidence only, not proof of legitimacy or protection against a rug. Use passive discovery and ordinary public access; no authentication bypass, secret retrieval, aggressive scanning, or exploitation.

## Execution architecture and acceptance gates

`Discovery → evidence/provenance → contract + market checks → category-specific research/report → policy evaluation → paper/manual/automatic entry → isolated signer → position monitoring → preapproved exit rules`

Collection, analysis and signing must remain separate. The eventual policy engine needs bounded amounts and slippage, atomic budget reservation, per-launch idempotency, current quote/simulation, source/contract freshness, audit trails, and a kill switch. Signer calls must enforce the policy independently of language-model output. Wallet detection alone is never a confirmed trade.

Report and persist separate timestamps for publication, observation, chain block time and verification where available. Missing information remains unknown; no fabricated addresses, prices, wallet performance, score inputs, launch coverage or test results.

## Build order

1. Finish real X + database setup and validate discovery coverage; ingest the user's actual account and wallet lists.
2. Verify platform/deployer identity and classify wallet swaps; add trusted market data and contract checks.
3. Add public docs/repository/subdomain research and connect meme/utility scoring to evidence-backed reports.
4. Build policy-controlled paper entries/exits, durable accounting and failure/restart tests.
5. Connect isolated live signing only after explicit limits/mode and validated adapters are available.

No feature becomes complete merely because it has a database table, environment variable, placeholder score, stub endpoint or a checkbox in this file. Every PR should name the rows it advances and the remaining acceptance gaps.

See [PRELAUNCH_RESEARCH.md](PRELAUNCH_RESEARCH.md) for the implemented research slice and [the initial tradedotcv review](research/tradedotcv-2026-09-09.md) for actual findings and collection gaps.

## Simplified watch intake (2026-09-10)
See [SIMPLE_WATCH.md](SIMPLE_WATCH.md): one X profile or website is sufficient to save a watch. Linked accounts, website evidence, public subdomains and mentioned addresses are assembled with provenance. Unresolved/ambiguous mappings stay visible; no automatic issuer trust. Related-account collection is bounded to six profiles and recent timelines when the deferred vendor setup is enabled.

