-- FICTIONAL sample seed for Phase 1 demo / local Docker init.
-- Clearly labeled FICTIONAL. Not real market data. Chain ID 4663.

INSERT INTO protocols (id, name, slug, kind, factory_address, website, notes, verified_onchain)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'Uniswap', 'uniswap', 'dex', NULL,
   'https://uniswap.org',
   'Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION on chain 4663.',
   false),
  ('11111111-1111-1111-1111-111111111102', 'Pools.trade', 'pools-trade', 'amm', NULL,
   NULL,
   'Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.',
   false),
  ('11111111-1111-1111-1111-111111111103', 'Pons', 'pons', 'other', NULL,
   NULL,
   'Protocol seed. factory_address NULL — NEEDS_ONCHAIN_VERIFICATION.',
   false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tokens (id, address, symbol, name, decimals, category, chain_id, description, is_watchlisted)
VALUES
  ('22222222-2222-2222-2222-222222222201',
   '0xFICTIONAL000000000000000000000000000001',
   'RHPEPE', 'RH Pepe (FICTIONAL)', 18, 'meme', 4663,
   'FICTIONAL sample meme token for dashboard demos. Not a real asset.', true),
  ('22222222-2222-2222-2222-222222222202',
   '0xFICTIONAL000000000000000000000000000002',
   'RHUTIL', 'RH Utility Index (FICTIONAL)', 18, 'utility', 4663,
   'FICTIONAL sample utility token. Research scaffolding only.', true),
  ('22222222-2222-2222-2222-222222222203',
   '0xFICTIONAL000000000000000000000000000003',
   'rhUSD', 'RH Demo Stable (FICTIONAL)', 6, 'stable', 4663,
   'FICTIONAL stablecoin placeholder.', false)
ON CONFLICT DO NOTHING;

INSERT INTO evidence (token_id, protocol_id, source, title, body, confidence, url)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101',
   'seed_fictional', 'FICTIONAL: meme narrative spike',
   'Synthetic evidence for scoring demos. Do not treat as market data.', 0.45,
   'https://robinhoodchain.blockscout.com'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102',
   'seed_fictional', 'FICTIONAL: utility integration note',
   'Placeholder on-chain usage signal for RHUTIL.', 0.5, NULL),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103',
   'seed_fictional', 'FICTIONAL: peg observation',
   'Demo peg-stability note — not live oracle data.', 0.4, NULL);

INSERT INTO scores (token_id, framework, opportunity, risk, evidence_confidence, breakdown, rationale)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'meme', 62.5, 71.0, 0.42,
   '{"liquidity":55,"momentum":70,"holderConcentration":65,"contractRisk":70,"narrative":80,"evidenceWeight":0.42}'::jsonb,
   'FICTIONAL meme score: elevated narrative/momentum with high risk from concentration and unverified contract.'),
  ('22222222-2222-2222-2222-222222222202', 'utility', 68.0, 38.5, 0.5,
   '{"liquidity":80,"momentum":40,"holderConcentration":30,"contractRisk":40,"narrative":35,"evidenceWeight":0.5}'::jsonb,
   'FICTIONAL utility score: solid liquidity and utility signals; moderate evidence confidence.'),
  ('22222222-2222-2222-2222-222222222203', 'utility', 45.0, 25.0, 0.4,
   '{"liquidity":70,"momentum":20,"holderConcentration":20,"contractRisk":30,"narrative":10,"evidenceWeight":0.4}'::jsonb,
   'FICTIONAL stable placeholder score.');

INSERT INTO wallets (address, label, tags, notes)
VALUES (
  '0xFICTIONALWALLET000000000000000000000001',
  'FICTIONAL research watcher',
  '["seed_fictional","demo"]'::jsonb,
  'Not a real wallet.'
)
ON CONFLICT DO NOTHING;

INSERT INTO reports (token_id, title, summary, body_markdown)
VALUES (
  '22222222-2222-2222-2222-222222222201',
  'FICTIONAL research brief: RHPEPE',
  'Demo report for Phase 1 dashboard. All figures are synthetic.',
  E'# FICTIONAL Report\n\nThis report is **not** investment advice. Data is seeded for UI/API testing on chain ID 4663 research tooling.\n'
);

INSERT INTO audit_log (action, actor, detail)
VALUES (
  'seed_fictional',
  '0001_seed_fictional.sql',
  '{"label":"FICTIONAL","note":"Docker init / demo seed"}'::jsonb
);
