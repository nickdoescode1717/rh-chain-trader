/**
 * In-memory FICTIONAL fallback when Postgres is unavailable.
 * Keeps local demo / tests working without Docker.
 */
import { scoreToken } from "@rh/core";

export interface MemToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  category: string;
  chainId: number;
  logoUrl: string | null;
  description: string | null;
  isWatchlisted: boolean;
  createdAt: string;
}

export interface MemProtocol {
  id: string;
  name: string;
  slug: string;
  kind: string;
  factoryAddress: string | null;
  website: string | null;
  notes: string | null;
  verifiedOnchain: boolean;
  createdAt: string;
}

export interface MemScore {
  id: string;
  tokenId: string;
  framework: string;
  opportunity: number;
  risk: number;
  evidenceConfidence: number;
  breakdown: Record<string, number>;
  rationale: string;
  scoredAt: string;
}

export interface MemEvidence {
  id: string;
  tokenId: string;
  protocolId: string | null;
  source: string;
  title: string;
  body: string;
  confidence: number;
  url: string | null;
  observedAt: string;
}

const now = () => new Date().toISOString();

export const memProtocols: MemProtocol[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    name: "Uniswap",
    slug: "uniswap",
    kind: "dex",
    factoryAddress: null, // NEEDS_ONCHAIN_VERIFICATION
    website: "https://uniswap.org",
    notes:
      "Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION on chain 4663.",
    verifiedOnchain: false,
    createdAt: now(),
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    name: "Pools.trade",
    slug: "pools-trade",
    kind: "amm",
    factoryAddress: null, // NEEDS_ONCHAIN_VERIFICATION
    website: null,
    notes: "Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.",
    verifiedOnchain: false,
    createdAt: now(),
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    name: "Pons",
    slug: "pons",
    kind: "other",
    factoryAddress: null, // NEEDS_ONCHAIN_VERIFICATION
    website: null,
    notes: "Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.",
    verifiedOnchain: false,
    createdAt: now(),
  },
];

export const memTokens: MemToken[] = [
  {
    id: "22222222-2222-2222-2222-222222222201",
    address: "0xFICTIONAL000000000000000000000000000001",
    symbol: "RHPEPE",
    name: "RH Pepe (FICTIONAL)",
    decimals: 18,
    category: "meme",
    chainId: 4663,
    logoUrl: null,
    description:
      "FICTIONAL sample meme token for dashboard demos. Not a real asset.",
    isWatchlisted: true,
    createdAt: now(),
  },
  {
    id: "22222222-2222-2222-2222-222222222202",
    address: "0xFICTIONAL000000000000000000000000000002",
    symbol: "RHUTIL",
    name: "RH Utility Index (FICTIONAL)",
    decimals: 18,
    category: "utility",
    chainId: 4663,
    logoUrl: null,
    description: "FICTIONAL sample utility token. Research scaffolding only.",
    isWatchlisted: true,
    createdAt: now(),
  },
  {
    id: "22222222-2222-2222-2222-222222222203",
    address: "0xFICTIONAL000000000000000000000000000003",
    symbol: "rhUSD",
    name: "RH Demo Stable (FICTIONAL)",
    decimals: 6,
    category: "stable",
    chainId: 4663,
    logoUrl: null,
    description: "FICTIONAL stablecoin placeholder.",
    isWatchlisted: false,
    createdAt: now(),
  },
];

const memeScore = scoreToken({
  category: "meme",
  liquidityScore: 55,
  volumeMomentum: 70,
  holderConcentration: 65,
  contractVerified: false,
  hasProxy: false,
  ageDays: 5,
  narrativeStrength: 80,
  socialMentions: 40,
  evidenceItems: [
    { confidence: 0.45, source: "seed_fictional" },
    { confidence: 0.5, source: "heuristic" },
  ],
});

const utilScore = scoreToken({
  category: "utility",
  liquidityScore: 80,
  volumeMomentum: 40,
  holderConcentration: 30,
  contractVerified: true,
  hasProxy: false,
  ageDays: 120,
  narrativeStrength: 35,
  utilitySignals: 75,
  evidenceItems: [{ confidence: 0.5, source: "seed_fictional" }],
});

const stableScore = scoreToken({
  category: "stable",
  liquidityScore: 70,
  volumeMomentum: 20,
  holderConcentration: 20,
  contractVerified: true,
  hasProxy: false,
  ageDays: 60,
  narrativeStrength: 10,
  utilitySignals: 50,
  evidenceItems: [{ confidence: 0.4, source: "seed_fictional" }],
});

export const memScores: MemScore[] = [
  {
    id: "33333333-3333-3333-3333-333333333301",
    tokenId: memTokens[0].id,
    framework: memeScore.framework,
    opportunity: memeScore.opportunity,
    risk: memeScore.risk,
    evidenceConfidence: memeScore.evidenceConfidence,
    breakdown: memeScore.breakdown as unknown as Record<string, number>,
    rationale: `FICTIONAL: ${memeScore.rationale}`,
    scoredAt: now(),
  },
  {
    id: "33333333-3333-3333-3333-333333333302",
    tokenId: memTokens[1].id,
    framework: utilScore.framework,
    opportunity: utilScore.opportunity,
    risk: utilScore.risk,
    evidenceConfidence: utilScore.evidenceConfidence,
    breakdown: utilScore.breakdown as unknown as Record<string, number>,
    rationale: `FICTIONAL: ${utilScore.rationale}`,
    scoredAt: now(),
  },
  {
    id: "33333333-3333-3333-3333-333333333303",
    tokenId: memTokens[2].id,
    framework: stableScore.framework,
    opportunity: stableScore.opportunity,
    risk: stableScore.risk,
    evidenceConfidence: stableScore.evidenceConfidence,
    breakdown: stableScore.breakdown as unknown as Record<string, number>,
    rationale: `FICTIONAL: ${stableScore.rationale}`,
    scoredAt: now(),
  },
];

export const memEvidence: MemEvidence[] = [
  {
    id: "44444444-4444-4444-4444-444444444401",
    tokenId: memTokens[0].id,
    protocolId: memProtocols[0].id,
    source: "seed_fictional",
    title: "FICTIONAL: meme narrative spike",
    body: "Synthetic evidence for scoring demos. Do not treat as market data.",
    confidence: 0.45,
    url: "https://robinhoodchain.blockscout.com",
    observedAt: now(),
  },
  {
    id: "44444444-4444-4444-4444-444444444402",
    tokenId: memTokens[1].id,
    protocolId: memProtocols[1].id,
    source: "seed_fictional",
    title: "FICTIONAL: utility integration note",
    body: "Placeholder on-chain usage signal for RHUTIL.",
    confidence: 0.5,
    url: null,
    observedAt: now(),
  },
];

export interface MemWallet {
  id: string;
  address: string;
  label: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
}

/** Empty-ready watched wallets (memory fallback when DB down). */
export const memWallets: MemWallet[] = [];

/** Desk-shaped wallet events (memory fallback). */
export interface MemWalletEvent {
  leadSource: "watched_wallet";
  wallet: string;
  walletLabel: string | null;
  token: string | null;
  tokenSymbol: string | null;
  amount: string | null;
  amountUsd: null;
  txHash: string | null;
  block: number | null;
  entryEstimate: null;
  otherWatchedOnToken: string[];
  observedAt: string;
}

export const memWalletEvents: MemWalletEvent[] = [];
