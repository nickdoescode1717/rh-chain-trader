// Run only against an isolated test database, never the user's trading database.
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { Hono } from 'hono';
import { initDb } from '../dist/db.js';
import { purchaseProposalRoutes } from '../dist/routes/purchase-proposals.js';
import { positionRoutes } from '../dist/routes/positions.js';
import { memPaperPositions } from '../dist/paper-positions-mem.js';
const url = new URL(process.env.DATABASE_URL);
assert.match(url.pathname, /^\/rh_pricing_test_[a-f0-9]+$/);
const sql = postgres(process.env.DATABASE_URL);
assert.equal((await initDb()).available, true);
const app = new Hono(); app.route('/purchase-proposals', purchaseProposalRoutes); app.route('/positions', positionRoutes);
const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const quote = { chainId: 4663, tokenAddress: token, source: 'dexscreener', pairId: '0x' + 'b'.repeat(64), quoteAddress: '0x' + '0'.repeat(40),
  priceEth: 0.001, priceUsd: 2, liquidityUsd: 10000, observedAt: new Date().toISOString(), sourceUpdatedAt: null, url: 'https://dexscreener.com/robinhood/test' };
await sql`insert into market_quotes(token_address, quote, last_attempt_at) values (${token}, ${sql.json(quote)}, now())`;
async function proposal() { const [row] = await sql`insert into purchase_proposals(token_address,size,status) values (${token},'eth:0.1','pending_nick') returning id`; return row.id; }
const approve = id => app.request(`/purchase-proposals/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-approval-token': process.env.TELEGRAM_APPROVAL_TOKEN }, body: JSON.stringify({actor: 'telegram:42'}) });
const id = await proposal();
const attempts = await Promise.all([approve(id), approve(id)]);
assert.deepEqual(attempts.map(r => r.status).sort(), [200,409]);
let rows = await sql`select * from positions where proposal_id=${id}`;
assert.equal(rows.length, 1); assert.equal(rows[0].entry_snapshot.currency, 'ETH'); assert.equal(rows[0].entry_snapshot.quantity, 100);
const positionId = rows[0].id, snapshot = rows[0].entry_snapshot;
await sql`update market_quotes set quote=${sql.json({...quote, priceEth: 0.002})} where token_address=${token}`;
memPaperPositions.length = 0; // exercise restart hydration
let data = (await (await app.request('/positions')).json()).data;
assert.equal(data.find(p => p.id===positionId).unrealizedPnl, 0.1);
rows = await sql`select entry_snapshot from positions where id=${positionId}`;
assert.deepEqual(rows[0].entry_snapshot, snapshot);
await sql`update market_quotes set quote=${sql.json({...quote, observedAt: new Date(Date.now()-181000).toISOString()})} where token_address=${token}`;
data = (await (await app.request('/positions')).json()).data;
assert.equal(data.find(p => p.id===positionId).unrealizedPnl, null);
const stale = await proposal(); assert.equal((await approve(stale)).status, 409);
assert.equal((await sql`select status from purchase_proposals where id=${stale}`)[0].status, 'pending_nick');
await sql`update market_quotes set quote=${sql.json({...quote, observedAt: new Date().toISOString()})} where token_address=${token}`;
await sql.unsafe("CREATE FUNCTION fail_test_position() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insertion failure'; END $$");
await sql.unsafe('CREATE TRIGGER fail_position BEFORE INSERT ON positions FOR EACH ROW EXECUTE FUNCTION fail_test_position()');
const failed = await proposal(); assert.equal((await approve(failed)).status, 500);
assert.equal((await sql`select status from purchase_proposals where id=${failed}`)[0].status, 'pending_nick');
assert.equal((await sql`select count(*)::int as count from positions where proposal_id=${failed}`)[0].count, 0);
assert.ok(!memPaperPositions.some(p => p.proposalId===failed));
console.log('PASS: concurrent approvals, atomic rollback, immutable entry, persisted hydration and stale-quote rejection');
await sql.end(); process.exit(0);
