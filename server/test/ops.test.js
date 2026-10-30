import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, op, viewer;
const PW = 'operator-pass-1';

const post = (token, url, body, method = 'POST') => fetch(`${srv.base}${url}`, {
  method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const read = async (key) => JSON.parse(await fs.readFile(path.join(srv.dataDir, `${key}.json`), 'utf8'));
const write = (key, data) => fs.writeFile(path.join(srv.dataDir, `${key}.json`), JSON.stringify(data));

async function login(username) {
  const res = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  return (await res.json()).token;
}

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
  await write('users', [mk('u1', 'op', 'operator'), mk('u2', 'view', 'viewer')]);
  op = await login('op');
  viewer = await login('view');
});
after(async () => { await srv.close(); });

const bin = (code, items = []) => ({ BinCode: code, Zone: 'Z', Capacity: 100, Status: 'active', Items: items });

test('viewer cannot use any write operation; unauthenticated gets 401', async () => {
  for (const [url, body] of [
    ['/api/ops/append', { key: 'rf_receiving_txns', record: { id: 'x' } }],
    ['/api/ops/bin-adjust', { binCode: 'A', itemCode: 'I', delta: 1 }],
    ['/api/ops/po-receive', { poId: 'p', lineIndex: 0, qty: 1 }],
    ['/api/ops/so-pick', { soId: 's', lineIndex: 0, qty: 1 }],
    ['/api/records/rf_waves/w1', { record: { id: 'w1' } }],
    ['/api/records/rf_waves/upsert-many', { records: [] }],
  ]) {
    const method = url.startsWith('/api/records/rf_waves/w1') ? 'PUT' : 'POST';
    assert.equal((await post(viewer, url, body, method)).status, 403, url);
  }
  assert.equal((await post(viewer, '/api/records/rf_waves/w1', undefined, 'DELETE')).status, 403);
  assert.equal((await fetch(`${srv.base}/api/ops/append`, { method: 'POST' })).status, 401);
});

test('append: 25 parallel transactions are all kept, newest first, retries do not duplicate', async () => {
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) =>
    post(op, '/api/ops/append', { key: 'rf_receiving_txns', record: { id: `RCV-${i}`, qty: 1 } })));
  assert.ok(results.every(r => r.status === 200));
  assert.equal((await read('rf_receiving_txns')).length, 25);
  const retry = await (await post(op, '/api/ops/append', { key: 'rf_receiving_txns', record: { id: 'RCV-3' } })).json();
  assert.equal(retry.added, 0);
  assert.equal((await read('rf_receiving_txns')).length, 25);
  const batch = await (await post(op, '/api/ops/append', { key: 'rf_cycle_count_txns', records: [{ id: 'a' }, { id: 'b' }] })).json();
  assert.equal(batch.added, 2);
  assert.deepEqual((await read('rf_cycle_count_txns')).map(r => r.id), ['a', 'b']);
});

test('append: validation and activity log cap of 100', async () => {
  assert.equal((await post(op, '/api/ops/append', { key: 'rf_bins', record: { id: 'x' } })).status, 400);
  assert.equal((await post(op, '/api/ops/append', { key: 'rf_receiving_txns', record: { qty: 1 } })).status, 400);
  assert.equal((await post(op, '/api/ops/append', { key: 'rf_receiving_txns', records: [] })).status, 400);
  await post(op, '/api/ops/append', { key: 'rf_activity_logs', records: Array.from({ length: 130 }, (_, i) => ({ id: `L${i}` })) });
  const logs = await read('rf_activity_logs');
  assert.equal(logs.length, 100);
  assert.equal(logs[0].id, 'L0');
});

test('bin-adjust: 20 parallel +1 from two "devices" sum to 20 (two-client concurrency)', async () => {
  await write('rf_bins', [bin('A-1')]);
  const op2 = await login('op');
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    post(i % 2 ? op : op2, '/api/ops/bin-adjust', { binCode: 'A-1', itemCode: 'ITEM', description: 'Thing', delta: 1 })));
  assert.ok(results.every(r => r.status === 200));
  const bins = await read('rf_bins');
  assert.equal(bins[0].Items.find(i => i.ItemCode === 'ITEM').Quantity, 20);
});

test('bin-adjust: refuses to go negative, clampAtZero clamps, setQuantity sets, missing bin needs createBin', async () => {
  await write('rf_bins', [bin('B-1', [{ ItemCode: 'X', Description: 'x', Quantity: 5 }])]);
  const refused = await post(op, '/api/ops/bin-adjust', { binCode: 'B-1', itemCode: 'X', delta: -6 });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).available, 5);
  assert.equal((await read('rf_bins'))[0].Items[0].Quantity, 5);
  assert.equal((await (await post(op, '/api/ops/bin-adjust', { binCode: 'B-1', itemCode: 'X', delta: -6, clampAtZero: true })).json()).quantity, 0);
  assert.equal((await (await post(op, '/api/ops/bin-adjust', { binCode: 'B-1', itemCode: 'X', setQuantity: 9 })).json()).quantity, 9);
  assert.equal((await post(op, '/api/ops/bin-adjust', { binCode: 'NOPE', itemCode: 'X', delta: 1 })).status, 404);
  const created = await post(op, '/api/ops/bin-adjust', { binCode: 'NEW', itemCode: 'X', delta: 3, createBin: { Zone: 'Dock' } });
  assert.equal(created.status, 200);
  assert.equal((await read('rf_bins')).find(b => b.BinCode === 'NEW').Zone, 'Dock');
});

test('bin-adjust: input validation', async () => {
  for (const body of [
    { binCode: 'B-1', itemCode: 'X' },
    { binCode: 'B-1', itemCode: 'X', delta: 1, setQuantity: 1 },
    { binCode: 'B-1', itemCode: 'X', delta: 'a' },
    { binCode: 'B-1', itemCode: 'X', setQuantity: -1 },
    { binCode: 'B-1', itemCode: 'X', delta: 1, lots: [{ lotCode: 1 }] },
    { itemCode: 'X', delta: 1 },
  ]) assert.equal((await post(op, '/api/ops/bin-adjust', body)).status, 400, JSON.stringify(body));
});

test('bin-adjust: lots merge and serials add/remove', async () => {
  await write('rf_bins', [bin('C-1')]);
  const adj = (b) => post(op, '/api/ops/bin-adjust', { binCode: 'C-1', itemCode: 'L', ...b });
  await adj({ delta: 10, lots: [{ lotCode: 'L1', qty: 6 }, { lotCode: 'L2', qty: 4 }], serialsAdd: ['S1', 'S2'] });
  await adj({ delta: 2, lots: [{ lotCode: 'L1', qty: 2 }], serialsAdd: ['S2', 'S3'] });
  await adj({ delta: -4, lots: [{ lotCode: 'L2', qty: -4 }], serialsRemove: ['S1'] });
  const item = (await read('rf_bins'))[0].Items[0];
  assert.equal(item.Quantity, 8);
  assert.deepEqual(item.Lots, [{ lotCode: 'L1', qty: 8 }]);
  assert.deepEqual(item.Serials, ['S2', 'S3']);
});

test('po-receive: updates exactly one line even when ItemCode repeats; 10 parallel receipts add up', async () => {
  await write('rf_purchase_orders', [{
    id: 'po1', poNumber: '1', vendor: 'V', status: 'pending', expectedDate: '2026-01-01',
    items: [
      { LineNumber: 1, ItemCode: 'A', Description: 'a', OrderedQty: 10, ReceivedQty: 0 },
      { LineNumber: 2, ItemCode: 'A', Description: 'a', OrderedQty: 10, ReceivedQty: 0 },
    ],
  }]);
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    post(op, '/api/ops/po-receive', { poId: 'po1', lineIndex: 0, qty: 1, binCode: 'A-1' })));
  assert.ok(results.every(r => r.status === 200));
  let po = (await read('rf_purchase_orders'))[0];
  assert.equal(po.items[0].ReceivedQty, 10);
  assert.equal(po.items[1].ReceivedQty, 0);
  assert.equal(po.items[0].RemainingQty, 0);
  assert.equal(po.status, 'receiving');
  const done = await (await post(op, '/api/ops/po-receive', { poId: 'po1', lineIndex: 1, qty: 10 })).json();
  assert.equal(done.po.status, 'completed');
  assert.ok(done.po.receivedDate);
});

test('po-receive and so-pick: not-found and bad input', async () => {
  assert.equal((await post(op, '/api/ops/po-receive', { poId: 'zzz', lineIndex: 0, qty: 1 })).status, 404);
  assert.equal((await post(op, '/api/ops/po-receive', { poId: 'po1', lineIndex: 9, qty: 1 })).status, 404);
  assert.equal((await post(op, '/api/ops/po-receive', { poId: 'po1', lineIndex: 0, qty: 0 })).status, 400);
  assert.equal((await post(op, '/api/ops/po-receive', { poId: 'po1', lineIndex: -1, qty: 1 })).status, 400);
  assert.equal((await post(op, '/api/ops/so-pick', { soId: 'zzz', lineIndex: 0, qty: 1 })).status, 404);
  assert.equal((await post(op, '/api/ops/so-pick', { soId: 'zzz', lineIndex: 0, qty: -1 })).status, 400);
});

test('so-pick: updates one line, status goes picking then picked', async () => {
  await write('rf_sales_orders', [{
    id: 'so1', soNumber: '1', status: 'open',
    items: [
      { ItemCode: 'A', OrderedQty: 4, DeliveredQty: 0, RemainingQty: 4 },
      { ItemCode: 'A', OrderedQty: 2, DeliveredQty: 0, RemainingQty: 2 },
    ],
  }]);
  const first = await (await post(op, '/api/ops/so-pick', { soId: 'so1', lineIndex: 0, qty: 4 })).json();
  assert.equal(first.so.status, 'picking');
  assert.equal(first.so.items[1].DeliveredQty, 0);
  const second = await (await post(op, '/api/ops/so-pick', { soId: 'so1', lineIndex: 1, qty: 2 })).json();
  assert.equal(second.so.status, 'picked');
  assert.ok(second.so.shippedDate);
});

test('records: upsert, replace, delete, upsert-many with skipExisting', async () => {
  await write('rf_waves', []);
  assert.equal((await post(op, '/api/records/rf_waves/w1', { record: { id: 'w1', n: 1 } }, 'PUT')).status, 200);
  assert.equal((await (await post(op, '/api/records/rf_waves/w1', { record: { id: 'w1', n: 2 } }, 'PUT')).json()).created, false);
  assert.equal((await post(op, '/api/records/rf_waves/w1', { record: { id: 'other' } }, 'PUT')).status, 400);
  assert.equal((await post(op, '/api/records/rf_bins/b1', { record: { id: 'b1' } }, 'PUT')).status, 400);
  const many = await (await post(op, '/api/records/rf_waves/upsert-many', {
    records: [{ id: 'w1', n: 99 }, { id: 'w2', n: 1 }], skipExisting: true })).json();
  assert.deepEqual([many.added, many.skipped, many.updated], [1, 1, 0]);
  assert.equal((await read('rf_waves')).find(w => w.id === 'w1').n, 2);
  const replace = await (await post(op, '/api/records/rf_waves/upsert-many', { records: [{ id: 'w1', n: 99 }] })).json();
  assert.equal(replace.updated, 1);
  assert.equal((await post(op, '/api/records/rf_waves/w2', undefined, 'DELETE')).status, 200);
  assert.equal((await post(op, '/api/records/rf_waves/w2', undefined, 'DELETE')).status, 404);
  assert.deepEqual((await read('rf_waves')).map(w => w.id), ['w1']);
});

test('parallel record upserts to different records are all kept', async () => {
  await write('rf_orders', []);
  await Promise.all(Array.from({ length: 15 }, (_, i) =>
    post(op, `/api/records/rf_orders/o${i}`, { record: { id: `o${i}` } }, 'PUT')));
  assert.equal((await read('rf_orders')).length, 15);
});
