# Prelaunch project research

This feature connects a monitored X handle and public project domain to an evidence report. It advances the original platform/subdomain research and Grok-report requirements. Live token sniping and automatic exits remain unimplemented; see [PRODUCT_ALIGNMENT.md](PRODUCT_ALIGNMENT.md).

## What runs

- `research_projects` stores one latest snapshot per handle. Migration 0007 seeds the user-supplied `tradedotcv` example with `trade.cv`, classified as utility based on its stated product. This is a research lead, not verified ownership or a token endorsement.
- The opt-in collector claims one eligible project per minute, with at least an hour between scheduled attempts per project. Slow requests add delay; this is not an exact-hour SLA. Registration updates reset the report and schedule. Multiple workers use a compare-and-set claim, and stale results cannot overwrite a changed project.
- The inspector retrieves its homepage, certificate-transparency records from crt.sh, and at most eight concrete in-domain subdomain roots discovered in public links or certificates. Wildcard certificates do not create invented hosts. No guessed paths, port scans, private IP targets, login bypass, secret retrieval, or JavaScript execution. HTTPS/DNS targets are checked and pinned to public IPv4; IPv6-only sites are currently unsupported. Per-request timeout, response-size and redirect limits apply.
- Website and development surfaces contribute at most 10 of 100 evidence points. The other eight categories remain unknown until reviewed evidence is implemented. Overall rating is withheld below 50% coverage. This release's automatic inspector therefore normally returns **insufficient evidence**, not an invented investment score. Coverage and positive evidence points are displayed separately. A dev/API/staging page cannot prove legitimacy.
- Up to 20 recent signals from the project's registered X account join the report with source links and observation times. The existing official X scanner supplies these separately; web research does not scrape X. No broad X search or recursive related-account monitoring was added here.
- Optional Grok narrative enrichment uses a configured xAI model and structured JSON. Its output has cited evidence IDs and explicit missing evidence; fabricated source IDs are rejected. Citation validation does not prove that a model's claims follow from those sources. Model output never changes scores, identity checks, purchase policy or execution. The adapter uses the documented Chat Completions compatibility endpoint and makes no model tool calls or X searches.
- Existing Grok-primary purchase proposal and Telegram-fallback interfaces are preserved. A new read-only Grok handoff bundles research for the existing bot/Desk workflow; it does not send a message, create a proposal or approve a purchase automatically.

## Setup

1. Apply migrations through `0007_project_research.sql`. For an existing database already initialized through 0006, apply only 0007 through your normal migration procedure. Compose init mounts run only on fresh Postgres volumes; rebuilding does not migrate an existing volume. Do not delete the volume to migrate.
2. Set `PROJECT_RESEARCH_ENABLED=true` on the collector for public website research. Set up X independently as described in [X_DISCOVERY.md](X_DISCOVERY.md).
3. Optional paid enrichment: configure `XAI_API_KEY` and `XAI_MODEL` in the collector's secret environment, set provider spend limits, then set `GROK_RESEARCH_ENABLED=true`. Both research flags default false. No secret belongs in an API request, dashboard, repository or report. Grok Bot and xAI API credentials are distinct integrations.
4. Use the dashboard's **Project research** tab or the API through the existing private tunnel. Registering a project also registers its X handle if missing; existing X preferences remain unchanged. Pausing research does not pause X monitoring; manage that separately in Discovery.

```http
POST /research/projects
Content-Type: application/json

{"handle":"tradedotcv","domain":"trade.cv","category":"utility"}
```

`GET /research/projects` lists scheduling status. `GET /research/projects/tradedotcv` returns the persisted report. `GET /research/projects/tradedotcv/grok-handoff` returns research JSON for Grok, or 409 until a report exists. Missing PostgreSQL returns 503 instead of fictional reports. The API retains the repository's private-network/tunnel trust model; do not expose it publicly without authentication.

For a one-off public inspection without Postgres or X:

```sh
pnpm --filter @rh/collector research --handle tradedotcv --domain trade.cv --category utility --output report.json
```

Leave `GROK_RESEARCH_ENABLED` unset/false for an unbilled public-web-only inspection. The CLI reports partial collection failures in `subdomains.errors`; exit code zero does not mean every source was accessible. The CLI does not load private `.env` files automatically.

## Before launch execution

The report exposes outstanding domain/token/deployer verification, contract permissions/liquidity/tax/sellability checks, a current executable quote and simulation, explicit spend/slippage/exit policy, and an isolated signer. These are requirements, not completed integrations. Exact ticker/name matches or links from untrusted posts do not verify an official token. Existing factory/address correlation is available in Discovery, but does not establish issuer identity.

This branch neither signs nor submits transactions, funds wallets, promises transaction ordering, nor enables automated buying/selling. Connecting policy-controlled execution requires implementing and testing the missing adapters and accounting described in the alignment checklist.

## Validation

Unit/API tests cover passive host scope/caps, invalid public targets, missing-source behavior, rubric weights, fabricated citations, opt-in provider calls, model-output isolation and request validation. Tests mock web/X/xAI responses. Full TypeScript build and lint cover API, web and workers. Real PostgreSQL concurrency/restart behavior, live xAI/X access and browser interaction require separate environment validation.

Primary provider reference: [xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs).
