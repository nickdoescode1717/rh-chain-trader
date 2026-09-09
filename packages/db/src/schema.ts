/**
 * Drizzle schema for Robinhood Chain research agent (Phase 1).
 * Trading tables exist as DISABLED stubs only.
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
 * DISABLED Phase 1 stubs — no production trading paths.
 * Rows may exist for schema completeness; application must refuse to act on them.
 */
export const purchaseProposals = pgTable("purchase_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenId: uuid("token_id").references(() => tokens.id),
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

export const positions = pgTable("positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").notNull().default("disabled"),
  note: text("note").notNull().default("DISABLED_PHASE1_NO_TRADING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Protocol = typeof protocols.$inferSelect;
export type Token = typeof tokens.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
