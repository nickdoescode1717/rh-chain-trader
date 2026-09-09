/**
 * Seeds FICTIONAL sample data for local/demo use.
 * All evidence sources are labeled seed_fictional.
 */
import { createDb } from "./client.js";
import {
  protocols,
  tokens,
  evidence,
  scores,
  reports,
  auditLog,
} from "./schema.js";

async function main() {
  const db = createDb();

  console.log("Seeding FICTIONAL research data...");

  const [uni, pools, pons] = await db
    .insert(protocols)
    .values([
      {
        name: "Uniswap",
        slug: "uniswap",
        kind: "dex",
        // NEEDS_ONCHAIN_VERIFICATION
        factoryAddress: null,
        website: "https://uniswap.org",
        notes:
          "Protocol seed for RH Chain research. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION against chain 4663.",
        verifiedOnchain: false,
      },
      {
        name: "Pools.trade",
        slug: "pools-trade",
        kind: "amm",
        // NEEDS_ONCHAIN_VERIFICATION
        factoryAddress: null,
        website: null,
        notes:
          "Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.",
        verifiedOnchain: false,
      },
      {
        name: "Pons",
        slug: "pons",
        kind: "other",
        // NEEDS_ONCHAIN_VERIFICATION
        factoryAddress: null,
        website: null,
        notes:
          "Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.",
        verifiedOnchain: false,
      },
    ])
    .returning();

  const [tokMeme, tokUtil, tokStable] = await db
    .insert(tokens)
    .values([
      {
        address: "0xFICTIONAL000000000000000000000000000001",
        symbol: "RHPEPE",
        name: "RH Pepe (FICTIONAL)",
        decimals: 18,
        category: "meme",
        chainId: 4663,
        description:
          "FICTIONAL sample meme token for dashboard demos. Not a real asset.",
        isWatchlisted: true,
      },
      {
        address: "0xFICTIONAL000000000000000000000000000002",
        symbol: "RHUTIL",
        name: "RH Utility Index (FICTIONAL)",
        decimals: 18,
        category: "utility",
        chainId: 4663,
        description:
          "FICTIONAL sample utility token. Research scaffolding only.",
        isWatchlisted: true,
      },
      {
        address: "0xFICTIONAL000000000000000000000000000003",
        symbol: "rhUSD",
        name: "RH Demo Stable (FICTIONAL)",
        decimals: 6,
        category: "stable",
        chainId: 4663,
        description: "FICTIONAL stablecoin placeholder.",
        isWatchlisted: false,
      },
    ])
    .returning();

  await db.insert(evidence).values([
    {
      tokenId: tokMeme.id,
      protocolId: uni.id,
      source: "seed_fictional",
      title: "FICTIONAL: meme narrative spike",
      body: "Synthetic evidence for scoring demos. Do not treat as market data.",
      confidence: 0.45,
      url: "https://robinhoodchain.blockscout.com",
    },
    {
      tokenId: tokUtil.id,
      protocolId: pools.id,
      source: "seed_fictional",
      title: "FICTIONAL: utility integration note",
      body: "Placeholder on-chain usage signal for RHUTIL.",
      confidence: 0.5,
    },
    {
      tokenId: tokStable.id,
      protocolId: pons.id,
      source: "seed_fictional",
      title: "FICTIONAL: peg observation",
      body: "Demo peg-stability note — not live oracle data.",
      confidence: 0.4,
    },
  ]);

  await db.insert(scores).values([
    {
      tokenId: tokMeme.id,
      framework: "meme",
      opportunity: 62.5,
      risk: 71.0,
      evidenceConfidence: 0.42,
      breakdown: {
        liquidity: 55,
        momentum: 70,
        holderConcentration: 65,
        contractRisk: 70,
        narrative: 80,
        evidenceWeight: 0.42,
      },
      rationale:
        "FICTIONAL meme score: elevated narrative/momentum with high risk from concentration and unverified contract.",
    },
    {
      tokenId: tokUtil.id,
      framework: "utility",
      opportunity: 68.0,
      risk: 38.5,
      evidenceConfidence: 0.5,
      breakdown: {
        liquidity: 80,
        momentum: 40,
        holderConcentration: 30,
        contractRisk: 40,
        narrative: 35,
        evidenceWeight: 0.5,
      },
      rationale:
        "FICTIONAL utility score: solid liquidity and utility signals; moderate evidence confidence.",
    },
    {
      tokenId: tokStable.id,
      framework: "utility",
      opportunity: 45.0,
      risk: 25.0,
      evidenceConfidence: 0.4,
      breakdown: {
        liquidity: 70,
        momentum: 20,
        holderConcentration: 20,
        contractRisk: 30,
        narrative: 10,
        evidenceWeight: 0.4,
      },
      rationale: "FICTIONAL stable placeholder score.",
    },
  ]);

  // No fictional wallets — invalid hex breaks wallet-watcher eth_getLogs.

  await db.insert(reports).values({
    tokenId: tokMeme.id,
    title: "FICTIONAL research brief: RHPEPE",
    summary:
      "Demo report for Phase 1 dashboard. All figures are synthetic.",
    bodyMarkdown:
      "# FICTIONAL Report\n\nThis report is **not** investment advice. Data is seeded for UI/API testing on chain ID 4663 research tooling.\n",
  });

  await db.insert(auditLog).values({
    action: "seed_fictional",
    actor: "seed.ts",
    detail: {
      label: "FICTIONAL",
      protocols: [uni.slug, pools.slug, pons.slug],
      tokens: [tokMeme.symbol, tokUtil.symbol, tokStable.symbol],
    },
  });

  console.log("Seed complete (FICTIONAL data).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
