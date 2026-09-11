# Telegram collection controls and RPC efficiency

`/stop` persistently pauses all collector network activity, including Alchemy, X, website research and Grok. Telegram commands and saved portfolio data remain available. Already-dispatched requests may finish or abort within a few seconds; previously billed work cannot be reversed. Stale price/identity evidence continues to fail existing freshness gates. Stop does not liquidate holdings or change trading policy.

`/run` resumes research with chain monitoring OFF. `/chainon` explicitly enables chain-wide launch, watched-wallet, price and identity collection; `/chainoff` disables it. `/status` shows the persisted state and per-method RPC request attempts. `/usage` shows the separate US$0.50 X reservation allowance. All changes require the Telegram owner/service credential. Migration 0013 starts STOPPED with chain monitoring off, and database failures block new external requests.

Collector loops wait while paused; a common fetch guard rechecks durable state before every external request. Public HTTPS evidence reads have the same gate. A two-second watchdog aborts in-flight work on stop. A PostgreSQL-serialized request counter refuses RPC requests after 2,000 attempts per UTC day. This is a conservative software request limit, NOT a compute-unit or dollar budget: Alchemy charges can vary by method, results and plan. External programs using the same RPC key are outside this guard. HTTP authentication/quota/rate errors cause a one-hour provider cooldown. General quota errors no longer trigger recursive log-range splitting.

The previous factory listener ran every 15 seconds even without watched projects, fetched three metadata fields for each token, and stored cursors inside the container. This could consume substantial RPC quota, including repeated historical work after recreation. Changes:

- Broad listener/wallet polling has a five-minute minimum; startup wallet head lookup waits until a real watched wallet exists.
- Each catch-up pass handles at most 2,000 blocks instead of the full accumulated gap.
- Known token metadata is reused for launch ingestion; chain-ID reads are cached for five minutes.
- Launch and wallet cursors use the persistent `collector_state` volume. Deployment copies the previous cursor files before replacing the container.
- RPC calls have timeouts and quota backoff. Identity freshness requirements are preserved; chain-off means no fresh price/identity collection.

Five-minute broad scans are for economical research, not low-latency sniping. Targeted high-priority launch monitoring will need a separate measured policy and budget. No live execution is implemented.

Tests include authenticated API controls, transport blocking while stopped, separate RPC enablement, persistent state and concurrent final-request contention using mocked network responses in an isolated database. Production verification must leave the collector stopped logically and make no Alchemy requests while the user's quota is exhausted.
