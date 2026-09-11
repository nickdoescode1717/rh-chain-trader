# X discovery and the path to automatic entry

The Discovery dashboard manages monitored X accounts and shows posts, address mentions, observed follower/following changes, and exact-address matches against the existing launch collector. This release collects evidence; it does not authorize or execute buys.

## Planned provider: TwitterAPI.io

Nick selected **TwitterAPI.io** on 2026-09-09 and asked to configure it later. This is the planned provider for X scanning; its adapter and credentials are not configured yet. The current scanner uses the official X API, so the instructions below describe only that existing implementation.

Telegram is now the primary user interface and only trade-approval channel. Use the existing bot's project Watch/Pause/Resume controls; Grok remains backend analysis and proposal drafting only. The dashboard is optional administration.

When setup resumes, verify TwitterAPI.io's current endpoints, authentication, pagination, user-ID/handle behavior, post/profile/follower/following coverage, rate limits and costs against its documentation. Normalize its responses into the existing evidence/cursor flow and validate incomplete snapshots, deduplication and retry behavior. Do not merely substitute a TwitterAPI.io key into `X_BEARER_TOKEN` or change the base URL. Keep collection disabled until the adapter is ready. Grok remains the analysis layer, separate from this data-provider choice and Telegram approval authority.

## Existing official X API setup (not TwitterAPI.io)

1. Apply `packages/db/drizzle/0006_social_discovery.sql` to the existing database. New Compose volumes mount it at initialization; existing volumes do not automatically run new init scripts. Use the repository migration process after reviewing which earlier migrations are pending, or apply this SQL directly through your database administration process.
2. Rebuild API, collector, and web. Add monitored handles through `/discovery` or `POST /discovery/accounts` with `{"handle":"example","watchFollowing":true,"watchFollowers":false}`. Repeat with `enabled:false` to pause an account. No accounts are silently imported from the historical Markdown watchlist.
3. Configure `X_BEARER_TOKEN` in the collector's environment/secret store, never the browser or Git. Confirm developer access and set spending limits in the X Developer Console.
4. Explicitly set `X_DISCOVERY_ENABLED=true` and restart the collector. Merely adding handles does not enable paid reads. Default poll eligibility is five minutes; one account is serviced per scheduling tick, with a maximum of one page per enabled stream per account. More accounts/backlog increases effective latency.
5. Check account scan timestamps, errors, and coverage in the dashboard. New accounts get their current following/follower list as a baseline; this is not presented as a list of new follows.

Configuration: `X_POLL_MS` (default 300000), `X_ACCOUNTS_PER_TICK` (1), `X_GRAPH_INTERVAL_MS` (3600000), `X_MAX_GRAPH_USERS` (10000). Followers are off by default per account; following is on. Limits bound each tick's work, not dollar spending. Graphs larger than the user cap are labeled truncated, retain the previous baseline, and produce no inferred removal events. Tune account count/page throughput to your API budget. This polling implementation does not promise first-block entries.

## Evidence and completeness

- Reads official public X API endpoints with bearer authentication. No scraping, posting, following, DMs, or arbitrary URL fetches.
- Pins an account to its resolved X user ID after initial lookup. Renames do not silently redirect monitoring to another user. Profiles refresh at the graph interval, capturing bio addresses and public audience metrics. Related-account bios are also scanned; related accounts are not recursively subscribed. Add interesting accounts explicitly to monitor their posts.
- Posts preserve text, source URL, publication/observation times, public metrics, and extracted addresses. Long-post text and expanded URLs are included. A launch-language flag is a heuristic, not an AI investment score. Transaction hashes and zero addresses are excluded.
- Following and follower changes are observation-time differences between completed snapshots, not exact follow timestamps. X pagination is not an atomic historical snapshot; the graph can change while paging. Incomplete/error responses never count as an empty completed snapshot.
- Post cursors advance only when a full batch has been drained. Signals and cursor state commit in one database transaction. Replayed posts/profile evidence are deduplicated. Per-account failures preserve prior cursors; HTTP 429 backs off, and authorization/billing failures stop retries for an hour. Persistent expired pagination tokens currently require an operator to reset that account's cursor state after investigation.
- `/discovery/launch-matches` correlates the latest 500 signals with tokens on configured chain 4663 that have an existing Pons/pools.trade launch evidence record. It does not independently reverify factory deployments or prove issuer identity, safety, freshness, or profitability.
- Discovery requires PostgreSQL and reports 503 when it is unavailable. It never fabricates demo signals. Keep the existing API behind its SSH tunnel/access controls; registration is an administrative operation and this patch does not add API authentication.
- Configure retention/deletion under your X access agreement before operating at scale. This release does not implement automatic compliance-event handling or data retention cleanup.

## Remaining execution work

The user's requested direction is automatic buying when monitored platforms launch their tokens. Activation is pending: monitored official accounts and deployer mappings; per-token and daily spend limits; paper versus live mode; launch/router adapters; current liquidity, tax, sellability and slippage checks; durable budget reservations and deduplication; and an isolated signing service. Addresses discovered in posts remain unverified and are not automatically inserted into the curated trader-wallet list. The existing wallet collector reports incoming ERC-20 transfers, not verified swaps or buys.

`autoBuyEligible=false` and explicit blockers appear on each match. This is an honest unimplemented execution boundary, not a simulated completed trade. Grok/xAI analysis, broad X search, recursive account discovery, deployer transaction tracing, wallet swap classification, and automated selling remain separate work.

## Verification

`pnpm build`, `pnpm test`, `pnpm lint`. Collector tests use mocked X responses covering paging, incomplete snapshots, address extraction, rate limits, and failed scans. API tests cover input validation and missing storage. Real X access and PostgreSQL integration require configured services and are not claimed by those tests.

Official references checked 2026-09-09:

- [User posts](https://docs.x.com/x-api/users/get-posts) — `/2/users/:id/tweets`, `post.fields`, `since_id`, pagination.
- [Following](https://docs.x.com/x-api/users/get-following) and [followers](https://docs.x.com/x-api/users/get-followers).
- [Username lookup](https://docs.x.com/x-api/users/get-user-by-username).
- [API pricing](https://docs.x.com/x-api/getting-started/pricing) — verify actual rates and limits in your Developer Console.
