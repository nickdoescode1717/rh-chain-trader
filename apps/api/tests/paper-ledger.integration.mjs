// Isolated disposable database only. Never use production rows or a trading account.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { Hono } from 'hono';
import { units, decimal } from '@rh/core';
import { initDb } from '../dist/db.js';
import { purchaseProposalRoutes } from '../dist/routes/purchase-proposals.js';
import { paperSellRoutes } from '../dist/routes/paper-sells.js';
import { positionRoutes } from '../dist/routes/positions.js';
import { paperBalanceRoutes } from '../dist/routes/paper-balance.js';
assert.match(new URL(process.env.DATABASE_URL).pathname, /^\/rh_pricing_test_[a-f0-9]{16}$/);
assert.equal(process.env.PAPER_LEDGER_ENABLED, 'true');
const sql = postgres(process.env.DATABASE_URL);
assert.equal((await initDb()).available, true);
const app = new Hono(); app.route('/purchase-proposals', purchaseProposalRoutes); app.route('/paper-sells', paperSellRoutes);
app.route('/positions', positionRoutes); app.route('/paper-balance', paperBalanceRoutes);
const token = '0x' + 'a'.repeat(40);
const quote = { chainId: 4663, tokenAddress: token, source: 'dexscreener', pairId: '0x' + 'b'.repeat(64), quoteAddress: '0x' + '0'.repeat(40),
  priceEth: 0.001, priceUsd: 2, liquidityUsd: 1000000, observedAt: new Date().toISOString(), sourceUpdatedAt: null, url: 'https://dexscreener.com/robinhood/test' };
await sql`insert into market_quotes(token_address, quote, last_attempt_at) values (${token}, ${sql.json(quote)}, now())`;
// Legacy holding has known cost but no trustworthy price/quantity. Preserve and reserve its cost.
const [legacy] = await sql`insert into positions(token_address,size,status) values (${token},'eth:0.1','simulated_open') returning id`;
async function proposal(size = 'eth:0.6') { return (await sql`insert into purchase_proposals(token_address,size,status) values (${token},${size},'pending_nick') returning id`)[0].id; }
async function post(path, body = {}, secret = process.env.TELEGRAM_APPROVAL_TOKEN) {
  const r = await app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-approval-token': secret }, body: JSON.stringify({ actor: 'telegram:42', ...body }) });
  return { status: r.status, body: await r.json() };
}
async function read(path) { const r = await app.request(path); assert.equal(r.status, 200); return (await r.json()).data; }
const approve = id => post(`/purchase-proposals/${id}/approve`);
const preview = (id, percent = 25) => post(`/paper-sells/${id}/preview`, { percent });
const confirm = id => post(`/paper-sells/${id}/confirm`);
const balance = () => read('/paper-balance');
const cash = async () => units((await balance()).cashEth);
const refresh = async (overrides = {}) => sql`update market_quotes set quote=${sql.json({ ...quote, observedAt: new Date().toISOString(), ...overrides })}, last_error=null where token_address=${token}`;
assert.equal(await cash(), units('0.9'));
assert.equal((await preview(legacy.id)).body.error, 'legacy_entry_quantity_missing');
assert.equal((await sql`select entry_snapshot from positions where id=${legacy.id}`)[0].entry_snapshot, null);

// Competing proposals cannot spend the same capital. Replayed approvals have one immutable fill.
const ids = await Promise.all([proposal(), proposal()]);
const approvals = await Promise.all(ids.map(approve));
assert.deepEqual(approvals.map(r => r.status).sort(), [200,409]);
const approved = approvals.find(r => r.status === 200).body, pid = approved.position.id;
assert.equal(await cash(), units('0.3'));
assert.equal(approvals.find(r => r.status === 409).body.error, 'insufficient_paper_cash');
const retries = await Promise.all([approve(approved.data.id), approve(approved.data.id)]);
assert.ok(retries.every(r => r.status === 200 && r.body.replayed && r.body.fill.id === approved.fill.id));
assert.equal((await sql`select count(*)::int as n from paper_fills where position_id=${pid}`)[0].n, 1);
const originalSnapshot = (await sql`select entry_snapshot from positions where id=${pid}`)[0].entry_snapshot;

// Cancel actually invalidates the durable preview, including previously copied confirmation buttons.
const cancelled = (await preview(pid)).body.data;
assert.equal((await post(`/paper-sells/${cancelled.id}/cancel`)).status, 200);
assert.equal((await confirm(cancelled.id)).status, 409);
const expired = (await preview(pid)).body.data;
await sql`update paper_sell_intents set expires_at=now()-interval '1 second' where id=${expired.id}`;
assert.equal((await confirm(expired.id)).body.error, 'sell_preview_expired');
const repriced = (await preview(pid)).body.data;
await refresh({ priceEth: 0.0005 });
assert.equal((await confirm(repriced.id)).body.error, 'price_moved_refresh_preview');
await refresh({ observedAt: new Date(Date.now()-91000).toISOString() });
assert.equal((await preview(pid)).body.error, 'fresh_entry_quote_required');
await refresh({ tokenAddress: '0x' + 'c'.repeat(40) });
assert.equal((await preview(pid)).status, 409); // no same-name/copycat quote substitution
await refresh({ priceEth: 0.002 });

// Two previews against one holding: one settles, its replay is safe, the other becomes obsolete.
const previews = await Promise.all([preview(pid,25), preview(pid,50)]);
const first = previews[0].body.data, obsolete = previews[1].body.data;
const cashBefore = await cash();
const concurrent = await Promise.all([confirm(first.id), confirm(first.id)]);
assert.ok(concurrent.every(r => r.status === 200));
assert.deepEqual(concurrent.map(r => r.body.data.replayed).sort(), [false,true]);
assert.equal(concurrent[0].body.data.fill.id, concurrent[1].body.data.fill.id);
const sell = concurrent[0].body.data.fill;
assert.equal(await cash(), cashBefore + units(sell.execution.cashDelta));
assert.equal((await confirm(obsolete.id)).body.error, 'position_changed_refresh_preview');
assert.equal((await post(`/paper-sells/${first.id}/cancel`)).body.error, 'sell_already_executed');
let held = (await read('/positions')).find(p => p.id === pid);
assert.equal(units(held.remainingCost), units('0.45'));
assert.equal(units(held.realizedPnl), units(sell.execution.realizedPnl));
assert.deepEqual(held.entrySnapshot, originalSnapshot);
assert.ok(Math.abs(held.currentValue - Number(held.remainingQuantity)*0.002) < 1e-12);
assert.ok(Math.abs(held.unrealizedPnl - (held.currentValue - 0.45)) < 1e-12);

// Force a late accounting insert failure: fills, cash, holdings and intent must all roll back.
const failing = (await preview(pid,50)).body.data;
const before = { cash: await cash(), held, fills: (await read('/paper-sells/history')).length };
await sql.unsafe("CREATE FUNCTION fail_test_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intentional test failure'; END $$");
await sql.unsafe('CREATE TRIGGER test_ledger_failure BEFORE INSERT ON paper_ledger FOR EACH ROW EXECUTE FUNCTION fail_test_ledger()');
assert.equal((await confirm(failing.id)).status, 503);
assert.equal(await cash(), before.cash);
held = (await read('/positions')).find(p => p.id === pid);
assert.equal(held.remainingQuantity, before.held.remainingQuantity);
assert.equal((await read('/paper-sells/history')).length, before.fills);
assert.equal((await sql`select status from paper_sell_intents where id=${failing.id}`)[0].status, 'pending');
const failedBuy = await proposal('eth:0.01'); assert.equal((await approve(failedBuy)).status, 503);
assert.equal((await sql`select status from purchase_proposals where id=${failedBuy}`)[0].status, 'pending_nick');
assert.equal((await sql`select count(*)::int as n from positions where proposal_id=${failedBuy}`)[0].n, 0);
await sql.unsafe('DROP TRIGGER test_ledger_failure ON paper_ledger');

// Full exit closes only the remaining quantity and carries realized proceeds into durable cash.
await refresh({ priceEth: 0.0008 });
const finalPreview = (await preview(pid,100)).body.data;
const final = (await confirm(finalPreview.id)).body.data.fill;
held = (await read('/positions')).find(p => p.id === pid);
assert.equal(held.status, 'closed'); assert.equal(units(held.remainingQuantity), 0n); assert.equal(units(held.remainingCost), 0n);
assert.equal(held.currentValue, 0); assert.equal(held.unrealizedPnl, 0);
const realized = units(sell.execution.realizedPnl) + units(final.execution.realizedPnl);
assert.equal(units(held.realizedPnl), realized);
assert.equal(units((await balance()).realizedPnlEth), realized);
assert.equal(await cash(), units('0.9') + realized);
assert.equal((await preview(pid)).status, 409);
assert.equal((await approve(approved.data.id)).body.replayed, true); // cannot reopen a closed fill
assert.equal((await balance()).positions.length, 1); // legacy holding survives

// Storage itself rejects edits/deletes to financial history. A mismatch stops decisions and reads.
await assert.rejects(sql`update paper_ledger set delta=0 where event_key='initial:ETH'`);
await assert.rejects(sql`delete from paper_fills where id=${sell.id}`);
const saved = decimal(await cash());
await sql`update paper_accounts set cash=cash+1 where currency='ETH'`;
assert.equal((await app.request('/paper-balance')).status, 503);
assert.equal((await approve(await proposal('eth:0.01'))).status, 503);
await sql`update paper_accounts set cash=${saved} where currency='ETH'`;

// A genuinely new Node process reads the same book, regardless of changed bootstrap defaults.
const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
  import {initDb} from './dist/db.js'; import {ledgerBook} from './dist/paper-ledger.js';
  await initDb(); const b=(await ledgerBook()).balance;
  console.log(JSON.stringify({cash:b.cashEth,realized:b.realizedPnlEth,open:b.positions.length})); process.exit(0);
`], { encoding: 'utf8', env: { ...process.env, PAPER_CASH_ETH: '999' }, timeout: 15000 });
assert.equal(child.status, 0);
const restored = JSON.parse(child.stdout.trim().split('\n').at(-1));
assert.equal(units(restored.cash), units(saved)); assert.equal(units(restored.realized), realized); assert.equal(restored.open, 1);

// USD cannot borrow ETH balance; approval and sell mutation endpoints require Telegram owner auth.
assert.equal((await approve(await proposal('usd:1'))).body.error, 'insufficient_paper_cash');
for (const action of ['preview','confirm','cancel']) {
  assert.equal((await post(`/paper-sells/${first.id}/${action}`, {}, 'wrong')).status, 403);
  assert.equal((await post(`/paper-sells/${first.id}/${action}`, { actor: 'grok' })).status, 403);
}
console.log('PASS: legacy adoption; concurrent budgets; idempotent buys/sells; cancellation/expiry/price/address gates; partial/full cost and P&L; atomic failure rollback; immutable history; reconciliation; actual process restart; currency/auth isolation.');
await sql.end(); process.exit(0);
