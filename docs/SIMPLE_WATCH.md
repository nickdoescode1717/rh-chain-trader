# One-input Telegram watches

Use `/watch @account`, `/watch https://x.com/account`, or `/watch project.com`. `/projects` shows both old projects and new/unresolved watches. Telegram sends the discovery update and provides Refresh, Pause/Resume, and research/identity buttons when a project mapping exists. The old explicit `/watch @handle domain [category]` remains supported.

Migration 0011 adds durable watch intake independently of project identity. Registration returns immediately. With `PROJECT_RESEARCH_ENABLED=true`, the collector handles one watch per minute, no more than once per hour per watch (including failures). Website-only watches receive research even without an X account. Duplicate normalized inputs retain their report and hourly schedule. Commands require the Telegram owner/service credential; external collection cannot create approvals.

Discovery follows a supplied site's homepage and up to two linked about/team/docs pages using the existing public-DNS-pinned HTTPS reader. It records up to 12 linked accounts, documentation/repository links and mentioned addresses with source URLs, then runs the existing public subdomain/evidence report and optional Grok analysis. A single site-linked X account is only a candidate mapping. Multiple accounts/sites stay ambiguous; registered mappings are never overwritten or automatically resumed by discovery. Watch pause updates the associated project/account and discards in-flight results. Existing mapping conflicts remain visible.

## TwitterAPI.io

`WATCH_X_ENABLED=true` plus collector-only `TWITTERAPI_IO_KEY` enables the new watch enrichment adapter. Both are off/unset by default; setup and paid activation remain deferred. Without it, X-only inputs with no known domain remain saved waiting for a website, and website research still works. No direct X scraping or short-link guessing occurs.

The adapter uses [profile lookup](https://docs.twitterapi.io/api-reference/endpoint/get_user_by_username) with `userName` and `X-API-Key`, preferring expanded profile URLs. [Recent posts](https://docs.twitterapi.io/api-reference/endpoint/get_user_last_tweets) are collected for up to six directly linked/bio-mentioned accounts, at most 20 posts each per hourly scan. Timeouts, response size limits, exact author matching and explicit failure states apply. Live vendor access has not been validated without credentials. This is a bounded recent-post sample, not comprehensive history, follower-graph monitoring or real-time launch coverage. The separate older official-X graph scanner remains unchanged and disabled.

Discovery records source relationships, not verified team membership. It never enrolls wallets, reviews identity claims, approves a token, changes trading policy, or enables signing. Existing paper identity gates still apply. Newly discovered meme/utility category remains unknown until supported inputs are available.

Watch alerts persist across restarts alongside Telegram research alert state, ignore timestamp-only updates, skip paused/in-progress scans, and send at most five changed cards per minute. As with existing Telegram notifications, a crash after send and before persistence can duplicate delivery.

## Validation

Local tests cover normalization/unsafe inputs, website-only and ambiguous discovery, bounded related profiles, vendor errors/exact author matching, Telegram cards and restart deduplication. `apps/api/tests/watch.integration.mjs` and `workers/collector/tests/watch.integration.mjs` run only in a randomly named isolated schema clone and cover authenticated intake, duplicate schedule preservation, pause propagation, interrupted collection, immutable existing mappings and absent identity trust.
