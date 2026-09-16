# Upcoming-launch due diligence

Use `/launch @account`, an X profile URL, or a website in Telegram. Existing watch cards also offer **Flag upcoming launch**. The bot saves a durable launch flag and runs additional DD during the next scheduled hourly watch scan. Repeating the command preserves the scan schedule, reports and pause state. Disabling launch DD leaves ordinary watch research intact. Flagging never enables global collection or chain monitoring.

## Implemented path

1. Reuse the existing bounded TwitterAPI.io profiles/posts and public watch pages. The US$0.50 shared rolling budget and source cache timestamps remain in force.
2. Read up to six additional linked public documentation/token/contract/deployment pages within the candidate project domain. Use the existing public DNS/TLS/response-size/time limits. No guessed private routes, X scraping, follower expansion or new paid X requests in this DD pass.
3. Extract addresses with role labels, excerpts, source URLs and observation times. Explicit deployer labels are candidates; factories, token addresses and unlabeled mentions are separate. Disclaimed/example addresses remain mentions. No social affiliation or subdomain establishes issuer trust.
4. Persist exact Pons V2 token/deployer/transaction/block observations from the existing factory listener. Reconcile flagged watches against those observations once per minute without additional RPC polling. Sources expire for matching after 24 hours. A deployer can launch multiple unrelated tokens; matching the wallet alone never selects an official token.
5. Where a uniquely declared exact token and chain on the registered project domain matches a supported event, prepare an immutable **untrusted identity draft**. Mapping conflicts, paused projects, changed domains and competing declarations block automatic drafts. Drafts are bounded to five active claims per project, concurrency/restart safe and never automatically recreated after owner revocation.
6. Telegram sends deduplicated updates when candidates, coverage or exact deployment leads change. The identity button opens the existing source-review flow. Fresh source and canonical deployment/receipt checks still apply independently; owner review remains mandatory and no trading policy is changed.

## Limits and cost controls

- This is launch preparation, **not an armed sniper or automatic purchase system**. No signer, buys, sells or trade policies were added.
- Automated event matching currently covers Pons V2 only. Other factory adapters, direct-deployer transaction monitoring, funding/history tracing and stronger official-account authentication remain work to do. Existing manual identity claims still support direct deployments.
- Existing chain polling has a five-minute minimum and bounded catch-up windows. It can lag substantially after a long pause; this does not promise first-block/first-50 execution. No historical index backfill was performed by this change.
- The new deployment index starts receiving events when the existing listener next runs. Old evidence rows without deployer topics are not reconstructed or guessed.
- Additional document reads consume ordinary network resources. Existing identity verification of new drafts consumes RPC within the shared daily cap once chain monitoring is enabled. Matching itself makes zero RPC calls.
- `/stop`, `/run`, `/chainon`, `/chainoff`, `/status` and `/usage` retain their meanings. All collection was stopped and chain monitoring off during implementation; do not automatically resume during deployment.
- Contracts, permissions, taxes, liquidity, sellability, execution policy and isolated signing are separate prerequisites for future sniping. A completed identity check is not a legitimacy or safety guarantee.

## Verification

Migration `0014_launch_preparation.sql` adds the flag/report and deployment index. Local tests cover extraction, source/chain conflicts, public-read limits, malformed/copycat event rejection and Telegram routing/deduplication. The isolated PostgreSQL launch integration exercises exact CA/deployer matches, multiple tokens per deployer, conflict/pause controls, concurrent reconciliation, process restart, owner revocation, stale evidence and zero RPC matching. Existing watch integration additionally verifies owner-only flags and preserved pause/schedule state.
