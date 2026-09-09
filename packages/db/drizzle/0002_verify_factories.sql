-- Verify protocol factory addresses on Robinhood Chain (4663).
-- Addresses confirmed via eth_getCode non-empty on public RPC.
-- Does NOT delete FICTIONAL seed tokens — Desk already ignores fictional;
-- new on-chain ingest must never use 0xFICTIONAL… addresses.

UPDATE protocols
SET
  factory_address = '0x8366a39cc670b4001a1121b8f6a443a643e40951',
  verified_onchain = true,
  notes = 'Uniswap v4 PoolManager on chain 4663. Source: official Uniswap deployments. eth_getCode non-empty. Verified 2026-09.'
WHERE slug = 'uniswap';

UPDATE protocols
SET
  factory_address = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  verified_onchain = true,
  notes = 'Pons V2 LaunchFactory on chain 4663. Sources: Bitquery + ponsfamily GitHub. eth_getCode non-empty. Legacy V1: 0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB. Verified 2026-09.'
WHERE slug = 'pons';

UPDATE protocols
SET
  factory_address = '0x0000ffffbe8efe702c8703ae3477ff5de3d319c0',
  verified_onchain = true,
  notes = 'pools.trade entry (current) on chain 4663. Original entry: 0x00004c4ccc709ef590f7c81102c0689f0263d4e9. eth_getCode non-empty. Verified 2026-09.'
WHERE slug = 'pools-trade';

-- Optional contract registry rows (idempotent)
INSERT INTO contracts (protocol_id, address, name, abi_hint, chain_id, notes)
SELECT p.id, '0x8366a39cc670b4001a1121b8f6a443a643e40951', 'PoolManager', 'uniswap-v4-pool-manager', 4663,
       'Verified Uniswap v4 PoolManager'
FROM protocols p WHERE p.slug = 'uniswap'
ON CONFLICT DO NOTHING;

INSERT INTO contracts (protocol_id, address, name, abi_hint, chain_id, notes)
SELECT p.id, '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e', 'LaunchFactory V2', 'pons-v2-launch-factory', 4663,
       'Verified Pons V2 LaunchFactory'
FROM protocols p WHERE p.slug = 'pons'
ON CONFLICT DO NOTHING;

INSERT INTO contracts (protocol_id, address, name, abi_hint, chain_id, notes)
SELECT p.id, '0x0000ffffbe8efe702c8703ae3477ff5de3d319c0', 'Entry (current)', 'pools-trade-entry', 4663,
       'Verified pools.trade current entry'
FROM protocols p WHERE p.slug = 'pools-trade'
ON CONFLICT DO NOTHING;

INSERT INTO contracts (protocol_id, address, name, abi_hint, chain_id, notes)
SELECT p.id, '0x00004c4ccc709ef590f7c81102c0689f0263d4e9', 'Entry (original)', 'pools-trade-entry-original', 4663,
       'Historical pools.trade entry'
FROM protocols p WHERE p.slug = 'pools-trade'
ON CONFLICT DO NOTHING;

INSERT INTO audit_log (action, actor, detail)
VALUES (
  'verify_factories',
  '0002_verify_factories.sql',
  '{"chainId":4663,"protocols":["uniswap","pons","pools-trade"],"note":"factory addresses set verified_onchain=true"}'::jsonb
);
