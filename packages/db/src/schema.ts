/**
 * Drizzle schema for Robinhood Chain research agent (Phase 1).
 * Trading tables exist as DISABLED stubs only — except purchase_proposals
 * which supports paper Nick-approval workflow (never auto-execute / no keys),
 * and positions which supports paper track/alert/sell-propose stubs
 * (see docs/POSITIONS.md; never live sells / no keys).
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const protocols = pgTable("protocols", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: text("kind").notNull(), // dex | amm | lending | bridge | nft | other
  // NEEDS_ONCHAIN_VERIFICATION — factory addresses intentionally null until verified on RH Chain
  factoryAddress: text("factory_address"),
  website: text("website"),
  notes: text("notes"),
  verifiedOnchain: boolean("verified_onchain").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    protocolId: uuid("protocol_id").references(() => protocols.id),
    address: text("address").notNull(),
    name: text("name"),
    abiHint: text("abi_hint"),
    chainId: integer("chain_id").notNull().default(4663),
    isProxy: boolean("is_proxy").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contracts_chain_addr").on(t.chainId, t.address)]
);

export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: text("address").notNull(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    decimals: integer("decimals").notNull().default(18),
    category: text("category").notNull().default("unknown"), // meme | utility | stable | unknown
    chainId: integer("chain_id").notNull().default(4663),
    logoUrl: text("logo_url"),
    description: text("description"),
    isWatchlisted: boolean("is_watchlisted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tokens_chain_addr").on(t.chainId, t.address)]
);

export const evidence = pgTable("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").references(() => tokens.id),
  protocolId: uuid("protocol_id").references(() => protocols.id),
  source: text("source").notNull(), // onchain | blockscout | manual | seed_fictional | heuristic
  title: text("title").notNull(),
  body: text("body").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  url: text("url"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: text("address").notNull(),
    label: text("label"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallets_address").on(t.address)]
);

export const walletEvents = pgTable("wallet_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  tokenId: uuid("token_id").references(() => tokens.id),
  eventType: text("event_type").notNull(),
  txHash: text("tx_hash"),
  blockNumber: integer("block_number"),
  amount: text("amount"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable("scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id")
    .notNull()
    .references(() => tokens.id),
  framework: text("framework").notNull(), // meme | utility | hybrid
  opportunity: real("opportunity").notNull(),
  risk: real("risk").notNull(),
  evidenceConfidence: real("evidence_confidence").notNull(),
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull(),
  rationale: text("rationale").notNull(),
  scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").references(() => tokens.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: text("action").notNull(),
  actor: text("actor").notNull().default("system"),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Paper purchase proposals — Nick approve/reject state machine.
 * Status: pending_nick | approved | rejected | expired | cancelled | disabled
 * Default stays non-executable. Never auto-execute; no keys; no tx submit.
 * See docs/PURCHASE_PROPOSALS.md
 */
export const purchaseProposals = pgTable("purchase_proposals", {
  projectHandle: text("project_handle"),
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").references(() => tokens.id),
  tokenAddress: text("token_address"),
  size: text("size"), // eth:0.05 | usd:100
  slippageBps: integer("slippage_bps"),
  exits: jsonb("exits").$type<Record<string, unknown>>(),
  scores: jsonb("scores").$type<Record<string, unknown>>(),
  sources: jsonb("sources").$type<Record<string, unknown>[]>(),
  leadSource: text("lead_source"), // ct | watched_wallet
  rationale: text("rationale"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  channel: text("channel"), // grok_primary | telegram_fallback
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  status: text("status").notNull().default("disabled"),
  note: text("note").notNull().default("DISABLED_PHASE1_NO_TRADING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").notNull().default("disabled"),
  note: text("note").notNull().default("DISABLED_PHASE1_NO_TRADING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Paper positions — track / LARGE-move alert / sell-propose state machine.
 * Status: simulated_open | alert_fired | sell_proposed | pending_nick
 *   | approved | rejected | signer_handoff_stub | closed | disabled
 * currentPrice nullable until oracle. Never auto-sell; no keys; no live sells.
 * See docs/POSITIONS.md
 */
export const positions = pgTable("positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").references(() => tokens.id),
  tokenAddress: text("token_address"),
  size: text("size"), // eth:0.05 | tokens:…
  entryPrice: text("entry_price"),
  currentPrice: text("current_price"), // nullable until oracle
  entrySnapshot: jsonb("entry_snapshot").$type<Record<string, unknown>>(),
  ledgerManaged: boolean("ledger_managed").notNull().default(false),
  remainingQuantity: numeric("remaining_quantity", { precision: 78, scale: 18 }),
  remainingCost: numeric("remaining_cost", { precision: 78, scale: 18 }),
  realizedPnl: numeric("realized_pnl", { precision: 78, scale: 18 }).notNull().default("0"),
  positionVersion: integer("position_version").notNull().default(0),
  markSource: text("mark_source"),
  markObservedAt: timestamp("mark_observed_at", { withTimezone: true }),
  pnlAbs: text("pnl_abs"),
  pnlPct: real("pnl_pct"),
  thresholds: jsonb("thresholds").$type<Record<string, unknown>>(),
  proposalId: uuid("proposal_id").references(() => purchaseProposals.id),
  lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  channel: text("channel"), // grok_primary | telegram
  status: text("status").notNull().default("disabled"),
  note: text("note").notNull().default("DISABLED_PHASE1_NO_TRADING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Protocol = typeof protocols.$inferSelect;
export type Token = typeof tokens.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export type PurchaseProposal = typeof purchaseProposals.$inferSelect;
export type Position = typeof positions.$inferSelect;

export const marketQuotes = pgTable("market_quotes", {
  tokenAddress: text("token_address").primaryKey(),
  chainId: integer("chain_id").notNull().default(4663),
  quote: jsonb("quote").$type<Record<string, unknown>>(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
  lastError: text("last_error"),
});

export const paperAccounts = pgTable("paper_accounts", {
  currency: text("currency").primaryKey(),
  cash: numeric("cash", { precision: 78, scale: 18 }).notNull(),
  realizedPnl: numeric("realized_pnl", { precision: 78, scale: 18 }).notNull().default("0"),
});
export const paperLedger = pgTable("paper_ledger", {
  id: uuid("id").defaultRandom().primaryKey(), eventKey: text("event_key").notNull().unique(),
  currency: text("currency").notNull().references(() => paperAccounts.currency),
  positionId: uuid("position_id").references(() => positions.id),
  kind: text("kind").notNull(), delta: numeric("delta", { precision: 78, scale: 18 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const paperFills = pgTable("paper_fills", {
  id: uuid("id").defaultRandom().primaryKey(), eventKey: text("event_key").notNull().unique(),
  positionId: uuid("position_id").notNull().references(() => positions.id),
  currency: text("currency").notNull(), side: text("side").notNull(),
  execution: jsonb("execution").$type<Record<string, unknown>>().notNull(),
  quote: jsonb("quote").$type<Record<string, unknown>>().notNull(), actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const paperSellIntents = pgTable("paper_sell_intents", {
  id: uuid("id").defaultRandom().primaryKey(), positionId: uuid("position_id").notNull().references(() => positions.id),
  positionVersion: integer("position_version").notNull(), percent: integer("percent").notNull(),
  actor: text("actor").notNull(), currency: text("currency").notNull(),
  minimumNet: numeric("minimum_net", { precision: 78, scale: 18 }).notNull(),
  preview: jsonb("preview").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"), fillId: uuid("fill_id").references(() => paperFills.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** X discovery is evidence collection only; these records never authorize orders. */
export const socialAccounts = pgTable("social_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: text("handle").notNull().unique(),
  xUserId: text("x_user_id").unique(),
  label: text("label"),
  enabled: boolean("enabled").notNull().default(true),
  watchFollowing: boolean("watch_following").notNull().default(true),
  watchFollowers: boolean("watch_followers").notNull().default(false),
  state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialSignals = pgTable("social_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => socialAccounts.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull().unique(),
  kind: text("kind").notNull(),
  sourceUrl: text("source_url").notNull(),
  text: text("text").notNull(),
  addresses: jsonb("addresses").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Project research snapshots, separate from trade authorization and token ownership. */
export const researchProjects = pgTable("research_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: text("handle").notNull().unique(),
  domain: text("domain").notNull(),
  category: text("category").notNull().default("unknown"),
  enabled: boolean("enabled").notNull().default(true),
  report: jsonb("report").$type<Record<string, unknown>>(),
  lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const identityClaims = pgTable("identity_claims", {
  id: uuid("id").defaultRandom().primaryKey(), projectHandle: text("project_handle").notNull().references(() => researchProjects.handle),
  domain: text("domain").notNull(), sourceUrl: text("source_url").notNull(), tokenAddress: text("token_address").notNull(),
  deployerAddress: text("deployer_address").notNull(), creationTxHash: text("creation_tx_hash").notNull(),
  report: jsonb("report").$type<Record<string, unknown>>(), checkedAt: timestamp("checked_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewedBy: text("reviewed_by"), reviewedSourceHash: text("reviewed_source_hash"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const identityReviews = pgTable("identity_reviews", {
  id: uuid("id").defaultRandom().primaryKey(), claimId: uuid("claim_id").notNull().references(() => identityClaims.id),
  sourceHash: text("source_hash").notNull(), actor: text("actor").notNull(), status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
