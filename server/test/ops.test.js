import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, op, viewer, viewerAsOp;
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
  viewerAsOp = await login('op');
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

// ---------- composite operations ----------

const seedReceiving = async () => {
  await write('rf_purchase_orders', [{
    id: 'poR', poNumber: '4001', vendor: 'V', status: 'pending', expectedDate: '2026-01-01',
    items: [
      { LineNumber: 1, ItemCode: 'A', Description: 'Widget', OrderedQty: 100, ReceivedQty: 0 },
      { LineNumber: 2, ItemCode: 'A', Description: 'Widget', OrderedQty: 100, ReceivedQty: 0 },
    ],
  }]);
  await write('rf_bins', []);
  await write('rf_receiving_txns', []);
};

test('receive: updates the PO line, the bin and the receiving log together; the log is built from the PO', async () => {
  await seedReceiving();
  const res = await post(op, '/api/ops/receive', {
    poId: 'poR', lineIndex: 1, qty: 7, binCode: 'DOCK', txnId: 'RCV-1', createBin: { Zone: 'Dock' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.quantity, 7);
  const po = (await read('rf_purchase_orders'))[0];
  assert.deepEqual(po.items.map(i => i.ReceivedQty), [0, 7]);
  assert.equal(po.items[1].BinCode, 'DOCK');
  const bins = await read('rf_bins');
  assert.equal(bins[0].Zone, 'Dock');
  assert.equal(bins[0].Items[0].Quantity, 7);
  const [txn] = await read('rf_receiving_txns');
  assert.deepEqual([txn.id, txn.poNumber, txn.itemCode, txn.description, txn.qty, txn.binCode],
    ['RCV-1', '4001', 'A', 'Widget', 7, 'DOCK']);
  assert.ok(txn.timestamp);
});

test('receive: retrying the same txnId changes nothing (safe after a lost response)', async () => {
  await seedReceiving();
  const body = { poId: 'poR', lineIndex: 0, qty: 5, binCode: 'DOCK', txnId: 'RCV-X', createBin: {} };
  assert.equal((await post(op, '/api/ops/receive', body)).status, 200);
  const retry = await (await post(op, '/api/ops/receive', body)).json();
  assert.equal(retry.duplicate, true);
  assert.equal((await read('rf_purchase_orders'))[0].items[0].ReceivedQty, 5);
  assert.equal((await read('rf_bins'))[0].Items[0].Quantity, 5);
  assert.equal((await read('rf_receiving_txns')).length, 1);
});

test('receive: two devices receiving at once add up across PO, bin and log', async () => {
  await seedReceiving();
  const op2 = await login('op');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => post(i % 2 ? op : op2, '/api/ops/receive', {
    poId: 'poR', lineIndex: 0, qty: 2, binCode: 'DOCK', txnId: `RCV-P${i}`, createBin: {},
  })));
  assert.ok(results.every(r => r.status === 200));
  assert.equal((await read('rf_purchase_orders'))[0].items[0].ReceivedQty, 24);
  assert.equal((await read('rf_bins'))[0].Items[0].Quantity, 24);
  assert.equal((await read('rf_receiving_txns')).length, 12);
});

test('receive: a rejected request leaves all three collections untouched', async () => {
  await seedReceiving();
  const before = [await read('rf_purchase_orders'), await read('rf_bins'), await read('rf_receiving_txns')];
  assert.equal((await post(op, '/api/ops/receive', { poId: 'nope', lineIndex: 0, qty: 1, binCode: 'D', txnId: 't1' })).status, 404);
  assert.equal((await post(op, '/api/ops/receive', { poId: 'poR', lineIndex: 9, qty: 1, binCode: 'D', txnId: 't2' })).status, 404);
  assert.equal((await post(op, '/api/ops/receive', { poId: 'poR', lineIndex: 0, qty: 1, binCode: 'D' })).status, 400);
  assert.equal((await post(op, '/api/ops/receive', { poId: 'poR', lineIndex: 0, qty: 1, txnId: 't3' })).status, 400);
  assert.deepEqual([await read('rf_purchase_orders'), await read('rf_bins'), await read('rf_receiving_txns')], before);
  assert.equal((await post(viewer, '/api/ops/receive', { poId: 'poR', lineIndex: 0, qty: 1, binCode: 'D', txnId: 't5' })).status, 403);
});

test('receive: lots and serials reach the PO line, the bin item and the log', async () => {
  await seedReceiving();
  await post(op, '/api/ops/receive', {
    poId: 'poR', lineIndex: 0, qty: 3, binCode: 'DOCK', txnId: 'RCV-L', createBin: {},
    lots: [{ lotCode: 'L1', qty: 3 }],
  });
  await post(op, '/api/ops/receive', {
    poId: 'poR', lineIndex: 1, qty: 2, binCode: 'DOCK', txnId: 'RCV-S', createBin: {},
    serials: ['S1', 'S2'],
  });
  const item = (await read('rf_bins'))[0].Items[0];
  assert.equal(item.Quantity, 5);
  assert.deepEqual(item.Lots, [{ lotCode: 'L1', qty: 3 }]);
  assert.deepEqual(item.Serials, ['S1', 'S2']);
  const po = (await read('rf_purchase_orders'))[0];
  assert.deepEqual(po.items[0].Lots, [{ lotCode: 'L1', qty: 3 }]);
  assert.deepEqual(po.items[1].Serials, ['S1', 'S2']);
});

test('pick-so: updates the SO line and takes stock from the bin; clamps at zero; missing bin is skipped', async () => {
  await write('rf_sales_orders', [{
    id: 'soP', soNumber: '9', status: 'pending',
    items: [
      { ItemCode: 'A', OrderedQty: 4, DeliveredQty: 0, RemainingQty: 4, BinCode: 'B-1' },
      { ItemCode: 'A', OrderedQty: 3, DeliveredQty: 0, RemainingQty: 3, BinCode: 'GONE' },
    ],
  }]);
  await write('rf_bins', [bin('B-1', [{ ItemCode: 'A', Description: 'a', Quantity: 3 }])]);
  const first = await (await post(op, '/api/ops/pick-so', { soId: 'soP', lineIndex: 0, qty: 4 })).json();
  assert.equal(first.so.status, 'picking');
  assert.equal(first.binQuantity, 0); // 3 in stock, 4 picked: clamps like the page always did
  const second = await (await post(op, '/api/ops/pick-so', { soId: 'soP', lineIndex: 1, qty: 3 })).json();
  assert.equal(second.so.status, 'picked');
  assert.equal(second.binQuantity, null);
  const so = (await read('rf_sales_orders'))[0];
  assert.deepEqual(so.items.map(i => i.DeliveredQty), [4, 3]);
});

test('pick-so: parallel picks on one bin all land; errors change nothing', async () => {
  await write('rf_sales_orders', [{
    id: 'soQ', soNumber: '10', status: 'pending',
    items: [{ ItemCode: 'A', OrderedQty: 40, DeliveredQty: 0, RemainingQty: 40, BinCode: 'B-1' }],
  }]);
  await write('rf_bins', [bin('B-1', [{ ItemCode: 'A', Description: 'a', Quantity: 100 }])]);
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    post(op, '/api/ops/pick-so', { soId: 'soQ', lineIndex: 0, qty: 2 })));
  assert.ok(results.every(r => r.status === 200));
  assert.equal((await read('rf_sales_orders'))[0].items[0].DeliveredQty, 40);
  assert.equal((await read('rf_bins'))[0].Items[0].Quantity, 60);
  assert.equal((await post(op, '/api/ops/pick-so', { soId: 'zzz', lineIndex: 0, qty: 1 })).status, 404);
  assert.equal((await post(viewer, '/api/ops/pick-so', { soId: 'soQ', lineIndex: 0, qty: 1 })).status, 403);
  assert.equal((await read('rf_bins'))[0].Items[0].Quantity, 60);
});

test('receive: a bin that does not exist yet is created (as the page always did)', async () => {
  await seedReceiving();
  const res = await post(op, '/api/ops/receive', { poId: 'poR', lineIndex: 0, qty: 1, binCode: 'NEWBIN', txnId: 'RCV-NB' });
  assert.equal(res.status, 200);
  const created = (await read('rf_bins')).find(b => b.BinCode === 'NEWBIN');
  assert.equal(created.Zone, 'Main');
  assert.equal(created.Items[0].Quantity, 1);
});

// ---------- counting / inventory operations ----------

test('records/apply: upserts and removes several records at once for counting data', async () => {
  await write('rf_cycle_counts', [{ id: 'c1', Status: 'pending' }, { id: 'c2', Status: 'pending' }]);
  const res = await post(op, '/api/records/rf_cycle_counts/apply', {
    upsert: [{ id: 'c1', Status: 'counted' }, { id: 'c3', Status: 'pending' }], remove: ['c2'],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, added: 1, updated: 1, removed: 1 });
  assert.deepEqual((await read('rf_cycle_counts')).map(c => [c.id, c.Status]), [['c1', 'counted'], ['c3', 'pending']]);
  for (const key of ['rf_inventory_sessions', 'rf_temporary_locations']) {
    assert.equal((await post(op, `/api/records/${key}/apply`, { upsert: [{ id: 'x' }] })).status, 200);
  }
  assert.equal((await post(op, '/api/records/rf_bins/apply', { upsert: [{ id: 'x' }] })).status, 400);
  assert.equal((await post(op, '/api/records/rf_cycle_counts/apply', {})).status, 400);
  assert.equal((await post(op, '/api/records/rf_cycle_counts/apply', { upsert: [{ nope: 1 }] })).status, 400);
  assert.equal((await post(viewer, '/api/records/rf_cycle_counts/apply', { upsert: [{ id: 'z' }] })).status, 403);
});

test('records/apply: two counters saving different sessions at the same time both land', async () => {
  await write('rf_inventory_sessions', []);
  await Promise.all(Array.from({ length: 12 }, (_, i) =>
    post(op, '/api/records/rf_inventory_sessions/apply', { upsert: [{ id: `s${i}`, name: `S${i}` }] })));
  assert.equal((await read('rf_inventory_sessions')).length, 12);
});

test('session count logs can be appended (each entry has an id)', async () => {
  await write('rf_session_count_logs', []);
  const res = await post(op, '/api/ops/append', { key: 'rf_session_count_logs', record: { id: 'log1', binCode: 'A' } });
  assert.equal(res.status, 200);
  assert.equal((await read('rf_session_count_logs')).length, 1);
});

test('bins-set: sets absolute quantities, adds new items and bins, all or nothing', async () => {
  await write('rf_bins', [bin('N-1', [{ ItemCode: 'X', Description: 'x', Quantity: 5 }])]);
  const res = await post(op, '/api/ops/bins-set', {
    newBins: [{ BinCode: 'N-2', Zone: 'Dock' }],
    changes: [
      { binCode: 'N-1', itemCode: 'X', setQuantity: 2 },
      { binCode: 'N-1', itemCode: 'NEW', description: 'New thing', setQuantity: 9 },
      { binCode: 'N-2', itemCode: 'X', description: 'x', setQuantity: 1 },
    ],
  });
  assert.equal(res.status, 200);
  const bins = await read('rf_bins');
  assert.deepEqual(bins[0].Items.map(i => [i.ItemCode, i.Quantity]), [['X', 2], ['NEW', 9]]);
  assert.equal(bins[1].Zone, 'Dock');
  assert.equal(bins[1].Items[0].Quantity, 1);

  const before = await read('rf_bins');
  const refused = await post(op, '/api/ops/bins-set', {
    changes: [{ binCode: 'N-1', itemCode: 'X', setQuantity: 7 }, { binCode: 'MISSING', itemCode: 'X', setQuantity: 1 }],
  });
  assert.equal(refused.status, 404);
  assert.deepEqual(await read('rf_bins'), before); // first change was NOT applied
  assert.equal((await post(op, '/api/ops/bins-set', { newBins: [{ BinCode: 'N-1' }] })).status, 409);
  assert.equal((await post(op, '/api/ops/bins-set', { changes: [{ binCode: 'N-1', itemCode: 'X', setQuantity: -1 }] })).status, 400);
  assert.equal((await post(op, '/api/ops/bins-set', {})).status, 400);
  assert.equal((await post(viewer, '/api/ops/bins-set', { changes: [{ binCode: 'N-1', itemCode: 'X', setQuantity: 1 }] })).status, 403);
});

test('bins-set: counting different bins from two devices at once keeps every count', async () => {
  await write('rf_bins', Array.from({ length: 10 }, (_, i) => bin(`C-${i}`, [{ ItemCode: 'X', Description: 'x', Quantity: 0 }])));
  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    post(i % 2 ? op : viewerAsOp, '/api/ops/bins-set', { changes: [{ binCode: `C-${i}`, itemCode: 'X', setQuantity: i + 1 }] })));
  const bins = await read('rf_bins');
  assert.deepEqual(bins.map(b => b.Items[0].Quantity), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
