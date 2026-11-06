// Phase 4: receiving and picking act on the specific LINE, are capped on the server, and stay
// correct when several people work at once. Orders come in through the real import endpoint, so
// the lines carry the same LineKeys they have in production.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, op, op2, viewer;
const PW = 'operator-pass-1';
let seq = 0;
const tid = () => `T-${++seq}`;

const call = (token, url, body, method = 'POST') => fetch(`${srv.base}${url}`, {
  method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const file = (key) => path.join(srv.dataDir, `${key}.json`);
const read = async (key) => JSON.parse(await fs.readFile(file(key), 'utf8'));
const readOr = async (key, fallback = []) => { try { return await read(key); } catch { return fallback; } };
const write = (key, data) => fs.writeFile(file(key), JSON.stringify(data));

async function login(username) {
  const res = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: PW }),
  });
  return (await res.json()).token;
}

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
  await write('users', [mk('u1', 'op', 'operator'), mk('u2', 'op2', 'operator'), mk('u3', 'view', 'viewer')]);
  op = await login('op'); op2 = await login('op2'); viewer = await login('view');
});
after(async () => { await srv.close(); });
beforeEach(async () => {
  for (const key of ['rf_purchase_orders', 'rf_sales_orders', 'rf_bins', 'rf_receiving_txns', 'rf_pick_txns']) {
    await fs.rm(file(key), { force: true });
  }
});

// ---- builders --------------------------------------------------------------------------
const bin = (code, items = []) => ({ BinCode: code, Zone: 'Z', Capacity: 1000, Status: 'active', Items: items });
const stock = (code, item, qty) => bin(code, [{ ItemCode: item, Description: item, Quantity: qty }]);
const line = (n, item, qty, extra = {}) => ({ LineNumber: n, ItemCode: item, Description: item, OrderedQty: qty, Warehouse: '01', ...extra });
const importPO = (doc, items, token = op) =>
  call(token, '/api/imports/orders', { kind: 'po', orders: [{ poNumber: String(doc), vendor: 'V', items }] });
const importSO = (doc, items, token = op) =>
  call(token, '/api/imports/orders', { kind: 'so', orders: [{ soNumber: String(doc), customer: 'C', items }] });
const getPO = async (doc) => (await read('rf_purchase_orders')).find((p) => p.poNumber === String(doc));
const getSO = async (doc) => (await read('rf_sales_orders')).find((s) => s.soNumber === String(doc));
const binQty = async (code, item) => (await read('rf_bins')).find((b) => b.BinCode === code)?.Items.find((i) => i.ItemCode === item)?.Quantity;

const recv = (po, lineKey, qty, extra = {}, token = op) =>
  call(token, '/api/ops/receive', { poId: po.id, lineKey, qty, binCode: '01-RACK', txnId: tid(), ...extra });
const pick = (so, lineKey, qty, extra = {}, token = op) =>
  call(token, '/api/ops/pick-so', { soId: so.id, lineKey, qty, txnId: tid(), scannedCode: so.items.find((i) => i.LineKey === lineKey)?.ItemCode, ...extra });

// ======================================================================================
// Line identity
// ======================================================================================

test('receiving: two lines with the same ItemCode on one PO are two lines; a receipt changes only the line it names', async () => {
  await importPO(1001, [line(0, 'DUP', 5), line(1, 'DUP', 3)]);
  const po = await getPO(1001);
  const res = await recv(po, '1001:1', 2);
  assert.equal(res.status, 200);
  const after = await getPO(1001);
  assert.deepEqual(after.items.map((i) => [i.LineKey, i.ReceivedQty]), [['1001:0', 0], ['1001:1', 2]]);
  const [txn] = await read('rf_receiving_txns');
  assert.equal(txn.lineKey, '1001:1');
  assert.equal(txn.qty, 2);
});

test('picking: four lines with the same ItemCode on one SO are picked one at a time', async () => {
  await importSO(2001, [line(0, 'REP', 2), line(1, 'OTHER', 1), line(2, 'REP', 5), line(3, 'REP', 1), line(4, 'REP', 4)]);
  await write('rf_bins', [stock('01-RACK', 'REP', 50), stock('01-RACK-B', 'OTHER', 5)]);
  let so = await getSO(2001);
  for (const k of ['2001:0', '2001:1', '2001:2', '2001:3', '2001:4']) {
    const l = so.items.find((i) => i.LineKey === k);
    await call(op, '/api/ops/so-assign-bin', { soId: so.id, lineKey: k, binCode: l.ItemCode === 'OTHER' ? '01-RACK-B' : '01-RACK' });
  }
  so = await getSO(2001);
  assert.equal((await pick(so, '2001:2', 5)).status, 200);
  const after = await getSO(2001);
  assert.deepEqual(after.items.map((i) => i.DeliveredQty), [0, 0, 5, 0, 0]);
  assert.equal(after.status, 'picking');
});

test('a handheld still holding an old screen cannot hit the wrong line after a re-import re-orders the lines', async () => {
  await importPO(1002, [line(1, 'A', 5), line(2, 'B', 5)]);
  const stale = await getPO(1002); // the handheld loaded this: B is at position 1
  assert.equal(stale.items[1].ItemCode, 'B');
  await importPO(1002, [line(0, 'NEW', 5), line(1, 'A', 5), line(2, 'B', 5)]); // SAP added a line that sorts first
  assert.equal((await getPO(1002)).items[1].ItemCode, 'A'); // position 1 is now A

  const res = await recv(stale, '1002:2', 3); // the handheld names the line by its key
  assert.equal(res.status, 200);
  const after = await getPO(1002);
  assert.deepEqual(after.items.map((i) => [i.ItemCode, i.ReceivedQty]), [['NEW', 0], ['A', 0], ['B', 3]]);
});

test('a position alone is refused for a line that has a key (it could be the wrong line), and nothing changes', async () => {
  await importPO(1003, [line(0, 'A', 5)]);
  const po = await getPO(1003);
  const before = await read('rf_purchase_orders');
  const res = await call(op, '/api/ops/receive', { poId: po.id, lineIndex: 0, qty: 1, binCode: '01-RACK', txnId: tid() });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'LINE_KEY_REQUIRED');
  assert.deepEqual(await read('rf_purchase_orders'), before);
  await importSO(2002, [line(0, 'A', 2)]);
  const so = await getSO(2002);
  const res2 = await call(op, '/api/ops/pick-so', { soId: so.id, lineIndex: 0, qty: 1, txnId: tid(), scannedCode: 'A' });
  assert.equal(res2.status, 409);
  assert.equal((await res2.json()).code, 'LINE_KEY_REQUIRED');
});

test('an unknown line key is a 404', async () => {
  await importPO(1004, [line(0, 'A', 5)]);
  const po = await getPO(1004);
  const res = await recv(po, '1004:99', 1);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'LINE_NOT_FOUND');
});

test('orders imported before line keys existed can still be used by position until they are re-imported', async () => {
  await write('rf_purchase_orders', [{ id: 'po-old-1', poNumber: '77', vendor: 'V', status: 'pending', expectedDate: '', items: [
    { LineNumber: 1, ItemCode: 'A', Description: 'A', OrderedQty: 5, ReceivedQty: 0, RemainingQty: 5 },
  ] }]);
  const res = await call(op, '/api/ops/receive', { poId: 'po-old-1', lineIndex: 0, qty: 2, binCode: '01-RACK', txnId: tid() });
  assert.equal(res.status, 200);
});

// ======================================================================================
// Receiving: partial receipts and the over-receipt cap (enforced by the server)
// ======================================================================================

test('partial receipts add up to exactly the ordered quantity; one more is refused; the PO completes', async () => {
  await importPO(1010, [line(0, 'A', 5)]);
  let po = await getPO(1010);
  assert.equal((await recv(po, '1010:0', 2)).status, 200);
  assert.equal((await recv(po, '1010:0', 3)).status, 200);
  po = await getPO(1010);
  assert.equal(po.items[0].ReceivedQty, 5);
  assert.equal(po.items[0].RemainingQty, 0);
  assert.equal(po.status, 'completed');
  const over = await recv(po, '1010:0', 1);
  assert.equal(over.status, 409);
  const body = await over.json();
  assert.equal(body.code, 'OVER_RECEIPT');
  assert.equal(body.remaining, 0);
  assert.equal(body.requested, 1);
  assert.equal(await binQty('01-RACK', 'A'), 5);
});

test('over-receipt is refused in one piece: PO, bin and receiving log are all unchanged', async () => {
  await importPO(1011, [line(0, 'A', 5)]);
  const po = await getPO(1011);
  await recv(po, '1011:0', 4);
  const snapshot = [await read('rf_purchase_orders'), await read('rf_bins'), await read('rf_receiving_txns')];
  const res = await recv(po, '1011:0', 2);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, 'OVER_RECEIPT');
  assert.equal(body.remaining, 1);
  assert.deepEqual([await read('rf_purchase_orders'), await read('rf_bins'), await read('rf_receiving_txns')], snapshot);
});

test('four receivers racing for ten units, three at a time: exactly three receipts land, the fourth is refused', async () => {
  await importPO(1012, [line(0, 'A', 10)]);
  const po = await getPO(1012);
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => recv(po, '1012:0', 3, {}, i % 2 ? op : op2)));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 200, 200, 409]);
  assert.equal((await getPO(1012)).items[0].ReceivedQty, 9);
  assert.equal(await binQty('01-RACK', 'A'), 9);
  assert.equal((await read('rf_receiving_txns')).length, 3);
});

test('fractional quantities: 0.1 + 0.2 fills a line of 0.3 and 0.05 more is refused', async () => {
  await importPO(1013, [line(0, 'HOSE', 0.3)]);
  const po = await getPO(1013);
  assert.equal((await recv(po, '1013:0', 0.1)).status, 200);
  assert.equal((await recv(po, '1013:0', 0.2)).status, 200);
  assert.equal((await getPO(1013)).status, 'completed');
  assert.equal((await recv(po, '1013:0', 0.05)).status, 409);
});

test('a line SAP no longer lists is closed: it cannot be received', async () => {
  await importPO(1014, [line(0, 'A', 5), line(1, 'B', 5)]);
  await importPO(1014, [line(0, 'A', 5)]); // B dropped out of SAP's export
  const po = await getPO(1014);
  assert.equal(po.items[1].SapClosed, true);
  const res = await recv(po, '1014:1', 1);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'LINE_CLOSED');
});

test('the plain po-receive route cannot be used to get around the cap', async () => {
  await importPO(1015, [line(0, 'A', 2)]);
  const po = await getPO(1015);
  assert.equal((await call(op, '/api/ops/po-receive', { poId: po.id, lineKey: '1015:0', qty: 2 })).status, 200);
  const res = await call(op, '/api/ops/po-receive', { poId: po.id, lineKey: '1015:0', qty: 1 });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'OVER_RECEIPT');
});

test('the receiving log records who received, the line and the warehouse', async () => {
  await importPO(1016, [line(0, 'A', 5, { Warehouse: 5 })]);
  const po = await getPO(1016);
  await recv(po, '1016:0', 1, {}, op2);
  const [txn] = await read('rf_receiving_txns');
  assert.equal(txn.user, 'op2');
  assert.equal(txn.lineKey, '1016:0');
  assert.equal(txn.warehouse, '05');
});

// ======================================================================================
// Picking: over-pick, two pickers, scan confirmation, stock, short picks
// ======================================================================================

async function soWithBin(doc, items, stocks = [stock('01-RACK', 'A', 100)]) {
  await write('rf_bins', stocks);
  await importSO(doc, items);
  const so = await getSO(doc);
  for (const l of so.items) await call(op, '/api/ops/so-assign-bin', { soId: so.id, lineKey: l.LineKey, binCode: '01-RACK' });
  return getSO(doc);
}

test('over-pick is refused by the server and changes nothing', async () => {
  const so = await soWithBin(3001, [line(0, 'A', 4)]);
  const snapshot = [await read('rf_sales_orders'), await read('rf_bins')];
  const res = await pick(so, '3001:0', 5);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, 'OVER_PICK');
  assert.equal(body.remaining, 4);
  assert.deepEqual([await read('rf_sales_orders'), await read('rf_bins')], snapshot);
  assert.deepEqual(await readOr('rf_pick_txns'), []);
});

test('two pickers racing for one line: 4 pickers x 4 units on a line of 10, exactly two picks land', async () => {
  const so = await soWithBin(3002, [line(0, 'A', 10)]);
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => pick(so, '3002:0', 4, {}, i % 2 ? op : op2)));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 409, 409]);
  const refused = await Promise.all(results.filter((r) => r.status === 409).map((r) => r.json()));
  assert.ok(refused.every((b) => b.code === 'OVER_PICK' && b.remaining === 2));
  assert.equal((await getSO(3002)).items[0].DeliveredQty, 8);
  assert.equal(await binQty('01-RACK', 'A'), 92);
  assert.equal((await read('rf_pick_txns')).length, 2);
});

test('two pickers on different lines of the same order both land: neither overwrites the other', async () => {
  const so = await soWithBin(3003, [line(0, 'A', 3), line(1, 'A', 4)]);
  const [r1, r2] = await Promise.all([pick(so, '3003:0', 3, {}, op), pick(so, '3003:1', 4, {}, op2)]);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  const after = await getSO(3003);
  assert.deepEqual(after.items.map((i) => i.DeliveredQty), [3, 4]);
  assert.equal(after.status, 'picked');
  assert.equal(await binQty('01-RACK', 'A'), 93);
});

test('a pick and a re-import at the same moment: the pick survives whichever runs first', async () => {
  const so = await soWithBin(3004, [line(0, 'A', 10)]);
  const [p] = await Promise.all([
    pick(so, '3004:0', 3),
    call(op2, '/api/imports/orders', { kind: 'so', orders: [{ soNumber: '3004', customer: 'C', items: [line(0, 'A', 12)] }] }),
  ]);
  assert.equal(p.status, 200);
  const after = await getSO(3004);
  assert.equal(after.items[0].DeliveredQty, 3);
  assert.equal(after.items[0].OrderedQty, 12);
  assert.equal(after.items[0].RemainingQty, 9);
});

test('a pick and a ship update on the same order at the same moment keep both', async () => {
  const so = await soWithBin(3005, [line(0, 'A', 5), line(1, 'A', 5)]);
  const [p, s] = await Promise.all([
    pick(so, '3005:1', 5),
    call(op2, '/api/ops/so-ship', { shipments: [{ soId: so.id, shipmentPin: 'PIN123' }] }),
  ]);
  assert.equal(p.status, 200);
  assert.equal(s.status, 200);
  const after = await getSO(3005);
  assert.equal(after.items[1].DeliveredQty, 5);
  assert.equal(after.shipmentPin, 'PIN123');
  assert.equal(after.status, 'shipped');
  assert.ok(after.shippedDate);
});

test('so-ship only changes the shipping fields, is repeatable with the same PIN, and refuses a different PIN', async () => {
  const so = await soWithBin(3006, [line(0, 'A', 2)]);
  assert.equal((await call(op, '/api/ops/so-ship', { shipments: [{ soId: so.id, shipmentPin: 'P1' }] })).status, 200);
  assert.equal((await call(op, '/api/ops/so-ship', { shipments: [{ soId: so.id, shipmentPin: 'P1' }] })).status, 200);
  const res = await call(op, '/api/ops/so-ship', { shipments: [{ soId: so.id, shipmentPin: 'P2' }] });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'ALREADY_SHIPPED');
  assert.equal((await getSO(3006)).shipmentPin, 'P1');
  assert.equal((await call(op, '/api/ops/so-ship', { shipments: [{ soId: 'nope', shipmentPin: 'P1' }] })).status, 404);
  assert.equal((await call(viewer, '/api/ops/so-ship', { shipments: [{ soId: so.id, shipmentPin: 'P1' }] })).status, 403);
});

test('whole-order writes from a stale screen are refused for POs and SOs; the order operations are the only way to change them', async () => {
  const so = await soWithBin(3007, [line(0, 'A', 5)]);
  await pick(so, '3007:0', 2);
  const stale = { ...so, status: 'shipped' }; // a screen loaded before the pick
  for (const [url, body, method] of [
    [`/api/records/rf_sales_orders/${so.id}`, { record: stale }, 'PUT'],
    ['/api/records/rf_sales_orders/apply', { upsert: [stale], remove: [] }, 'POST'],
    ['/api/records/rf_sales_orders/upsert-many', { records: [stale] }, 'POST'],
    ['/api/records/rf_purchase_orders/upsert-many', { records: [{ id: 'x' }] }, 'POST'],
  ]) {
    const res = await call(op, url, body, method);
    assert.equal(res.status, 409, url);
    assert.equal((await res.json()).code, 'USE_ORDER_OPERATIONS');
  }
  assert.equal((await getSO(3007)).items[0].DeliveredQty, 2);
  // deleting an order (the trash icon) still works
  assert.equal((await call(op, `/api/records/rf_sales_orders/${so.id}`, undefined, 'DELETE')).status, 200);
});

// ---- scan confirmation ----

test('a pick needs the item to be scanned: missing and wrong codes are refused, the right one (any case) is accepted', async () => {
  const so = await soWithBin(3010, [line(0, 'itm-rep-01', 5)], [stock('01-RACK', 'itm-rep-01', 20)]);
  const none = await call(op, '/api/ops/pick-so', { soId: so.id, lineKey: '3010:0', qty: 1, txnId: tid() });
  assert.equal(none.status, 400);
  assert.equal((await none.json()).code, 'SCAN_REQUIRED');
  const wrong = await pick(so, '3010:0', 1, { scannedCode: 'SOMETHING-ELSE' });
  assert.equal(wrong.status, 409);
  assert.equal((await wrong.json()).code, 'SCAN_MISMATCH');
  assert.equal((await getSO(3010)).items[0].DeliveredQty, 0);
  const ok = await pick(so, '3010:0', 1, { scannedCode: '  ITM-REP-01 ' });
  assert.equal(ok.status, 200);
  const [txn] = await read('rf_pick_txns');
  assert.equal(txn.scannedCode, 'ITM-REP-01');
  assert.equal(txn.itemCode, 'itm-rep-01');
});

// ---- idempotency and the pick log ----

test('retrying a pick with the same transaction id changes nothing the second time', async () => {
  const so = await soWithBin(3011, [line(0, 'A', 10)]);
  const body = { soId: so.id, lineKey: '3011:0', qty: 4, txnId: 'PICK-FIXED', scannedCode: 'A' };
  assert.equal((await call(op, '/api/ops/pick-so', body)).status, 200);
  const retry = await (await call(op, '/api/ops/pick-so', body)).json();
  assert.equal(retry.duplicate, true);
  assert.equal((await getSO(3011)).items[0].DeliveredQty, 4);
  assert.equal(await binQty('01-RACK', 'A'), 96);
  assert.equal((await read('rf_pick_txns')).length, 1);
});

test('every pick is logged with who, what, where and when', async () => {
  const so = await soWithBin(3012, [line(0, 'A', 10, { Warehouse: 5 })]);
  await pick(so, '3012:0', 3, {}, op2);
  const [txn] = await read('rf_pick_txns');
  assert.deepEqual(
    { soNumber: txn.soNumber, lineKey: txn.lineKey, itemCode: txn.itemCode, qty: txn.qty, binCode: txn.binCode, warehouse: txn.warehouse, user: txn.user },
    { soNumber: '3012', lineKey: '3012:0', itemCode: 'A', qty: 3, binCode: '01-RACK', warehouse: '05', user: 'op2' });
  assert.ok(txn.timestamp);
});

// ---- bin stock: no silent clamp ----

test('picking more than the bin holds is refused (no silent clamp to zero) and nothing changes', async () => {
  const so = await soWithBin(3020, [line(0, 'A', 10)], [stock('01-RACK', 'A', 3)]);
  const snapshot = [await read('rf_sales_orders'), await read('rf_bins')];
  const res = await pick(so, '3020:0', 5);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, 'INSUFFICIENT_BIN_STOCK');
  assert.equal(body.available, 3);
  assert.equal(body.requested, 5);
  assert.deepEqual([await read('rf_sales_orders'), await read('rf_bins')], snapshot);
});

test('the picker can confirm the shortfall on purpose: the bin goes to zero and the difference is logged', async () => {
  const so = await soWithBin(3021, [line(0, 'A', 10)], [stock('01-RACK', 'A', 3)]);
  const res = await pick(so, '3021:0', 5, { acceptShortfall: true });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.binQuantity, 0);
  assert.equal(body.shortfall, 2);
  assert.equal((await getSO(3021)).items[0].DeliveredQty, 5);
  const [txn] = await read('rf_pick_txns');
  assert.equal(txn.shortfall, 2);
  assert.equal(txn.stockBefore, 3);
});

test('when the bin has enough stock there is no shortfall on the record', async () => {
  const so = await soWithBin(3022, [line(0, 'A', 10)], [stock('01-RACK', 'A', 50)]);
  await pick(so, '3022:0', 5, { acceptShortfall: true });
  const [txn] = await read('rf_pick_txns');
  assert.equal(txn.shortfall, undefined);
  assert.equal(await binQty('01-RACK', 'A'), 45);
});

test('a bin that is not in the system cannot be checked: the pick goes through and the log says stock was not tracked', async () => {
  await importSO(3023, [line(0, 'A', 2)]);
  const so0 = await getSO(3023);
  await write('rf_bins', [stock('01-RACK', 'A', 9)]);
  await write('rf_sales_orders', [{ ...so0, items: [{ ...so0.items[0], BinCode: '01-GONE' }] }]);
  const so = await getSO(3023);
  const res = await pick(so, '3023:0', 2);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).binQuantity, null);
  const [txn] = await read('rf_pick_txns');
  assert.equal(txn.stockTracked, false);
  assert.equal(await binQty('01-RACK', 'A'), 9);
});

// ---- short picks ----

test('a short pick takes what the picker has, records why, and leaves the rest open', async () => {
  const so = await soWithBin(3030, [line(0, 'A', 5), line(1, 'A', 2)]);
  const res = await pick(so, '3030:0', 3, { short: { reason: 'Only 3 on the shelf' } });
  assert.equal(res.status, 200);
  const after = await getSO(3030);
  const l = after.items[0];
  assert.equal(l.DeliveredQty, 3);
  assert.equal(l.RemainingQty, 2);
  assert.deepEqual({ reason: l.ShortPick.reason, qtyPicked: l.ShortPick.qtyPicked, stillOpen: l.ShortPick.stillOpen, by: l.ShortPick.by }, { reason: 'Only 3 on the shelf', qtyPicked: 3, stillOpen: 2, by: 'op' });
  assert.equal(after.status, 'picking');
  const [txn] = await read('rf_pick_txns');
  assert.deepEqual(txn.short, { reason: 'Only 3 on the shelf', stillOpen: 2 });
});

test('a short pick needs a reason, and only makes sense when something stays open', async () => {
  const so = await soWithBin(3031, [line(0, 'A', 5)]);
  assert.equal((await pick(so, '3031:0', 3, { short: {} })).status, 400);
  assert.equal((await pick(so, '3031:0', 3, { short: { reason: '  ' } })).status, 400);
  const full = await pick(so, '3031:0', 5, { short: { reason: 'x' } });
  assert.equal(full.status, 400);
  assert.equal((await getSO(3031)).items[0].DeliveredQty, 0);
});

test('a line that cannot be picked at all can be reported short with nothing picked', async () => {
  const so = await soWithBin(3032, [line(0, 'A', 5)]);
  const res = await pick(so, '3032:0', 0, { short: { reason: 'Not found' } });
  assert.equal(res.status, 200);
  const l = (await getSO(3032)).items[0];
  assert.equal(l.DeliveredQty, 0);
  assert.equal(l.ShortPick.stillOpen, 5);
  assert.equal(await binQty('01-RACK', 'A'), 100);
  assert.equal((await pick(so, '3032:0', 0)).status, 400); // zero without a short report is still an error
});

test('the short-pick mark clears when the line is finished later', async () => {
  const so = await soWithBin(3033, [line(0, 'A', 5)]);
  await pick(so, '3033:0', 3, { short: { reason: 'Only 3' } });
  await pick(so, '3033:0', 2);
  const l = (await getSO(3033)).items[0];
  assert.equal(l.RemainingQty, 0);
  assert.equal(l.ShortPick, undefined);
});

// ---- closed lines and order completion ----

test('a line SAP no longer lists cannot be picked, and does not hold the order open', async () => {
  await write('rf_bins', [stock('01-RACK', 'A', 20)]);
  await importSO(3040, [line(0, 'A', 2), line(1, 'A', 3)]);
  let so = await getSO(3040);
  for (const l of so.items) await call(op, '/api/ops/so-assign-bin', { soId: so.id, lineKey: l.LineKey, binCode: '01-RACK' });
  await importSO(3040, [line(0, 'A', 2)]); // line 1 closed in SAP
  so = await getSO(3040);
  const closed = await pick(so, '3040:1', 1);
  assert.equal(closed.status, 409);
  assert.equal((await closed.json()).code, 'LINE_CLOSED');
  await pick(so, '3040:0', 2);
  assert.equal((await getSO(3040)).status, 'picked');
});

test('the real-bin rule still holds: a line without a real bin cannot be picked', async () => {
  await importSO(3041, [line(0, 'A', 2)]);
  const so = await getSO(3041);
  const res = await pick(so, '3041:0', 1);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'NO_REAL_BIN');
});

test('assigning a bin works by line key too', async () => {
  await write('rf_bins', [stock('01-RACK', 'A', 5)]);
  await importSO(3042, [line(0, 'A', 2), line(1, 'A', 2)]);
  const so = await getSO(3042);
  const res = await call(op, '/api/ops/so-assign-bin', { soId: so.id, lineKey: '3042:1', binCode: '01-rack' });
  assert.equal(res.status, 200);
  const after = await getSO(3042);
  assert.equal(after.items[0].BinCode, undefined);
  assert.equal(after.items[1].BinCode, '01-RACK');
});

test('a viewer cannot pick or receive', async () => {
  await importPO(1099, [line(0, 'A', 1)]);
  const po = await getPO(1099);
  assert.equal((await recv(po, '1099:0', 1, {}, viewer)).status, 403);
  await importSO(3099, [line(0, 'A', 1)]);
  const so = await getSO(3099);
  assert.equal((await pick(so, '3099:0', 1, {}, viewer)).status, 403);
});

// ---- the whole story on lines shaped like the real files ----

test('import -> receive -> SAP posts it -> re-import: the receipt is counted once and the PO can still be finished', async () => {
  await importPO(1200, [line(0, 'A', 10), line(1, 'B', 4)]);
  let po = await getPO(1200);
  await recv(po, '1200:0', 4);
  // SAP now shows those 4 as received (goods receipt posted) and the PO is exported again
  await importPO(1200, [line(0, 'A', 10, { ReceivedQty: 4 }), line(1, 'B', 4)]);
  po = await getPO(1200);
  assert.equal(po.items[0].ReceivedQty, 4);
  assert.equal(po.items[0].RemainingQty, 6);
  assert.equal((await recv(po, '1200:0', 6)).status, 200);
  assert.equal((await recv(po, '1200:0', 1)).status, 409);
});
