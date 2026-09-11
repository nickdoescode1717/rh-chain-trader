# Durable paper trading

Telegram is the sole approval channel. This implementation records simulated fills only; live signing and transaction submission remain disabled.

## User flow

Approve a proposal in Telegram to spend the stated budget, including the modeled entry fee. Open `/positions`, choose a position, and select Sell 25%, 50%, or 100% of its **remaining** tokens. The preview shows the full contract, quantity, modeled fee, expected net proceeds, realized P&L, minimum proceeds, and expiry. Confirm or cancel in Telegram. `/history` shows the latest 100 buy/sell fills, five per page. `/balance` separates durable cash, realized P&L, and estimated open-position value.

A sell preview lasts 90 seconds and permits at most a 1% decline in net proceeds from the preview. Confirmation revalidates the current quote and position version. A partial sell invalidates other previews for the old quantity. Cancellation is durable. Retrying the same confirmation returns its original fill, including after a timeout or restart. Reapproving a previously filled buy does not reopen it, even if it was subsequently sold.

## Accounting and storage

Migration `0009_paper_ledger.sql` adds currency accounts, an append-only cash ledger, append-only execution fills, remaining cost/quantity, accumulated realized P&L, and expiring sell intents. The API serializes settlement with a PostgreSQL transaction advisory lock. A buy or sell commits its cash, holdings, fill, ledger movement, decision status, and audit record atomically. Insufficient currency cash blocks a buy. ETH and USD are separate accounts, with no implicit conversion or borrowing.

Financial settlement uses integer arithmetic at 18 decimal places. Partial exits allocate the remaining cost proportionally; the final exit consumes all remaining cost and quantity. Fill records include their mode, model version, side, reference/execution prices, quantity, fee, cash delta, cost allocation, and realized P&L, alongside the source quote and actor. Display valuations use floating-point estimates; persisted cash and settlement values use exact decimals.

Before book reads or settlement, cash is reconciled to ledger movements, account realized P&L to immutable fills, and remaining position cost/quantity to recorded activity. Reconciliation or database errors block the operation; the ledger path never reports a memory-only success. Financial history rejects UPDATE/DELETE in PostgreSQL. This does not protect against a database administrator disabling triggers or restoring an old backup.

`PAPER_LEDGER_ENABLED=true` requires PostgreSQL and migration 0009. At first bootstrap only, `PAPER_CASH_ETH` (default 1) and `PAPER_CASH_USD` (default 0) seed simulated capital, less existing open-position costs. Bootstrap is locked and transactional. Changing those environment values later does not reset or top up the account. There is no user-facing reset/deposit feature in this release.

Existing holdings are preserved. Missing historical entry prices and quantities are never fabricated. Legacy positions without a trustworthy entry snapshot remain visible at known cost but cannot be sold through this model. Bootstrap fails if their known costs exceed initial capital.

## Simulation limits and future live adapter

`paper-v1` assumes a 0.3% fee and 0.5% adverse price slippage on each fill. These are transparent simulation parameters, **not measured pool fees or an executable quote**. Gas, token taxes, liquidity/size impact, failed transactions, MEV, token decimal restrictions, and execution latency are not simulated. The current source is a collected DEX Screener reference quote (at most 90 seconds old for settlement), not an on-chain swap simulation. These results cannot establish launch-sniping profitability or sellability.

The durable record shape and accounting invariants provide a basis for a future execution adapter. Live execution still needs verified issuer/deployer identity, contract and sellability checks, executable pool quotes, token base-unit precision, actual costs, budget reservations while transactions are pending, an isolated signer, nonce/replacement/reorg handling, and receipt reconciliation. It must settle confirmed actual fills rather than call the paper reference-price model. Live mode is not a configuration toggle in this release. Automatic entry and exit policies are also separate future work.

## Verification and deployment

Build core/db/API/Telegram and run their local tests. `apps/api/tests/paper-ledger.integration.mjs` additionally requires an isolated empty database whose name matches its explicit guard. Clone schema only, apply migration 0009, set test capital to 1 ETH/0 USD and enable the ledger. It tests legacy adoption, concurrent budgets, idempotency, cancellation, expiry, stale/wrong-token quotes, adverse repricing, partial/full exits, late-write rollback, immutable history, reconciliation, a new-process restart, and separate currencies/approval credentials.

Back up the database, environment and old images before deployment. Run integration tests before production migration. Stop Telegram during API cutover, apply the migration, enable the ledger, verify book reconciliation, then start Telegram. Preserve existing positions and bot state. Do not deploy the old memory-accounting application after ledger fills: it cannot account for partial exits or realized cash. If settlement breaks, stop trading decisions and fix forward against the preserved ledger; never restore an old database over new fills without an explicit reconciliation plan.
