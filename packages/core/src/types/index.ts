/** Robinhood Chain research agent — shared types (Phase 1). */

export const CHAIN_ID = 4663;
export const BLOCKSCOUT_BASE = "https://robinhoodchain.blockscout.com";

export type ProtocolKind = "dex" | "amm" | "lending" | "bridge" | "nft" | "other";
export type TokenCategory = "meme" | "utility" | "stable" | "unknown";
export type EvidenceSource =
  | "onchain"
  | "blockscout"
  | "manual"
  | "seed_fictional"
  | "heuristic";
export type ScoreFramework = "meme" | "utility" | "hybrid";

export interface Protocol {
  id: string;
  name: string;
  slug: string;
  kind: ProtocolKind;
  factoryAddress: string | null;
  website: string | null;
  notes: string | null;
  verifiedOnchain: boolean;
  createdAt: Date;
}

export interface Contract {
  id: string;
  protocolId: string | null;
  address: string;
  name: string | null;
  abiHint: string | null;
  chainId: number;
  isProxy: boolean;
  notes: string | null;
}

export interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  category: TokenCategory;
  chainId: number;
  logoUrl: string | null;
  description: string | null;
  isWatchlisted: boolean;
  createdAt: Date;
}

export interface Evidence {
  id: string;
  tokenId: string | null;
  protocolId: string | null;
  source: EvidenceSource;
  title: string;
  body: string;
  confidence: number; // 0–1
  url: string | null;
  observedAt: Date;
}

export interface Wallet {
  id: string;
  address: string;
  label: string | null;
  tags: string[];
  notes: string | null;
}

export interface WalletEvent {
  id: string;
  walletId: string;
  tokenId: string | null;
  eventType: string;
  txHash: string | null;
  blockNumber: number | null;
  amount: string | null;
  metadata: Record<string, unknown> | null;
  observedAt: Date;
}

export interface ScoreBreakdown {
  liquidity: number;
  momentum: number;
  holderConcentration: number;
  contractRisk: number;
  narrative: number;
  evidenceWeight: number;
}

export interface Score {
  id: string;
  tokenId: string;
  framework: ScoreFramework;
  opportunity: number; // 0–100
  risk: number; // 0–100
  evidenceConfidence: number; // 0–1
  breakdown: ScoreBreakdown;
  rationale: string;
  scoredAt: Date;
}

export interface Report {
  id: string;
  tokenId: string | null;
  title: string;
  summary: string;
  bodyMarkdown: string;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  detail: Record<string, unknown> | null;
  createdAt: Date;
}

/** Disabled in Phase 1 — schema stubs only. */
export interface PurchaseProposal {
  id: string;
  tokenId: string;
  status: "disabled";
  note: string;
}

export interface Order {
  id: string;
  status: "disabled";
  note: string;
}

export interface Position {
  id: string;
  status: "disabled";
  note: string;
}

export interface ScoringInput {
  category: TokenCategory;
  liquidityScore: number; // 0–100
  volumeMomentum: number; // 0–100
  holderConcentration: number; // 0–100 (higher = more concentrated = riskier)
  contractVerified: boolean;
  hasProxy: boolean;
  ageDays: number;
  narrativeStrength: number; // 0–100
  evidenceItems: Array<{ confidence: number; source: EvidenceSource }>;
  socialMentions?: number;
  utilitySignals?: number; // 0–100, used for utility framework
}

export interface ScoringResult {
  opportunity: number;
  risk: number;
  evidenceConfidence: number;
  framework: ScoreFramework;
  breakdown: ScoreBreakdown;
  rationale: string;
}
