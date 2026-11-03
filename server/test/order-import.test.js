import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';
import * as logic from '../ops-logic.js';

// --- Pure merge rules (no server) ---
const line = (n, over = {}) => ({ LineNumber: n, ItemCode: 'ITEM-100', Description: 'Widget', OrderedQty: 10, ReceivedQty: 0, RemainingQty: 10, BinCode: 'NO-BIN', Warehouse: '01', ...over });
const poFile = (number, items, over = {}) => ({ id: `po-${number}`, poNumber: String(number), vendor: 'Acme', cardCode: 'V-1', expectedDate: '2026-11-15', items, ...over });
const apply = (current, orders) => logic.applyOrderImport(current, { kind: 'po', orders });
const data = (out) => out.data;
const res = (out) => out.result;

test('same file twice: second run changes nothing', () => {
  const file = [poFile(5000001, [line(1), line(2, { ItemCode: 'ITEM-100' })])];
  const first = res(apply([], file));
  assert.equal(first.documentsAdded, 1);
  assert.equal(first.linesAdded, 2);
  const second = apply(data(apply([], file)), file);
  assert.deepEqual(res(second), { ok: true, documentsAdded: 0, documentsUpdated: 0, documentsUnchanged: 1, linesAdded: 0, linesUpdated: 0, linesKept: 0, linesRemoved: 0, total: 1 });
});

test('the record id is rebuilt from the document number, whatever the client sent', () => {
  const out = data(apply([], [poFile(5000001, [line(1)], { id: 'po-1699999999-0' })]));
  assert.equal(out[0].id, 'po-5000001');
});

test('an older record with a time-based id is matched by number, not duplicated', () => {
  const stored = [{ ...poFile(5000001, [line(1)]), id: 'po-1699999999-0' }];
  const out = apply(stored, [poFile(5000001, [line(1)])]);
  assert.equal(data(out).length, 1);
  assert.equal(res(out).documentsAdded, 0);
  // The stored id is kept: other records may already point at it.
  assert.equal(data(out)[0].id, 'po-1699999999-0');
});

test('re-import updates the ordered quantity and keeps what was received in the app', () => {
  let stored = data(apply([], [poFile(5000001, [line(1)])]));
  stored[0].items[0].ReceivedQty = 4;
  stored[0].items[0].RemainingQty = 6;
  const out = apply(stored, [poFile(5000001, [line(1, { OrderedQty: 12, RemainingQty: 12 })])]);
  const item = data(out)[0].items[0];
  assert.equal(item.OrderedQty, 12);
  assert.equal(item.ReceivedQty, 4);
  assert.equal(item.RemainingQty, 8);
  assert.equal(res(out).linesUpdated, 1);
});

test('when SAP shows more received than the app, received moves forward but never back', () => {
  let stored = data(apply([], [poFile(5000001, [line(1)])]));
  stored[0].items[0].ReceivedQty = 4;
  const fwd = data(apply(stored, [poFile(5000001, [line(1, { ReceivedQty: 6, RemainingQty: 4 })])]));
  assert.equal(fwd[0].items[0].ReceivedQty, 6);
  const back = data(apply(fwd, [poFile(5000001, [line(1, { ReceivedQty: 0, RemainingQty: 10 })])]));
  assert.equal(back[0].items[0].ReceivedQty, 6);
});

test('a new line is added; a line gone from SAP is removed only if nothing was received', () => {
  const stored = data(apply([], [poFile(5000001, [line(1), line(2, { ItemCode: 'B' }), line(3, { ItemCode: 'C' })])]));
  stored[0].items[1].ReceivedQty = 2; // line 2 has received stock: keep it, mark it
  const out = apply(stored, [poFile(5000001, [line(1), line(4, { ItemCode: 'D' })])]);
  const items = data(out)[0].items;
  assert.deepEqual(items.map(i => i.LineNumber), [1, 2, 4]);
  assert.equal(items[1].RemovedFromSource, true);
  assert.equal(res(out).linesAdded, 1);
  assert.equal(res(out).linesKept, 1);
  assert.equal(res(out).linesRemoved, 1);
});

test('a bin set in the app is kept over the bin in the file', () => {
  const stored = data(apply([], [poFile(5000001, [line(1, { BinCode: '01-RACK-A1' })])]));
  stored[0].items[0].BinCode = '01-RACK-Z9';
  stored[0].items[0].BinAssignedBy = 'op';
  const out = data(apply(stored, [poFile(5000001, [line(1, { BinCode: '01-RACK-A1' })])]));
  assert.equal(out[0].items[0].BinCode, '01-RACK-Z9');
});

test('the file sets the bin for lines nobody has touched', () => {
  const stored = data(apply([], [poFile(5000001, [line(1, { BinCode: 'NO-BIN' })])]));
  const out = data(apply(stored, [poFile(5000001, [line(1, { BinCode: '01-RACK-A1' })])]));
  assert.equal(out[0].items[0].BinCode, '01-RACK-A1');
});

test('validation: kind and document number are required', () => {
  assert.equal(logic.validateOrderImport({ kind: 'xx', orders: [] }).status, 400);
  assert.equal(logic.validateOrderImport({ kind: 'po', orders: [{ items: [] }] }).status, 400);
  assert.equal(logic.validateOrderImport({ kind: 'so', orders: [{ soNumber: '1', items: [] }] }), null);
});

// --- Through the HTTP route: concurrency and permissions ---
let srv, op, viewer;
const PW = 'operator-pass-1';
const post = (token, url, body) => fetch(`${srv.base}${url}`, {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
const read = async (key) => JSON.parse(await fs.readFile(path.join(srv.dataDir, `${key}.json`), 'utf8'));
async function login(username) {
  const r = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  return (await r.json()).token;
}

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([mk('u1', 'op', 'operator'), mk('u2', 'view', 'viewer')]));
  op = await login('op');
  viewer = await login('view');
});
after(async () => { await srv.close(); });

test('concurrent imports of the same PO from several devices create one PO', async () => {
  const body = { kind: 'po', orders: [poFile(6000001, [line(1), line(2, { ItemCode: 'ITEM-100' })])] };
  const replies = await Promise.all(Array.from({ length: 6 }, () => post(op, '/api/imports/orders', body)));
  const results = await Promise.all(replies.map(r => r.json()));
  assert.ok(replies.every(r => r.status === 200));
  assert.equal(results.reduce((sum, r) => sum + r.documentsAdded, 0), 1);
  const stored = await read('rf_purchase_orders');
  assert.equal(stored.filter(p => p.poNumber === '6000001').length, 1);
  assert.equal(stored.find(p => p.poNumber === '6000001').items.length, 2);
});

test('an SO import goes to the sales order collection', async () => {
  const body = { kind: 'so', orders: [{ soNumber: '8000001', customer: 'Cust', cardCode: 'C-1', items: [{ LineNumber: 1, ItemCode: 'A', OrderedQty: 3, DeliveredQty: 0, RemainingQty: 3 }] }] };
  assert.equal((await post(op, '/api/imports/orders', body)).status, 200);
  const sos = await read('rf_sales_orders');
  assert.equal(sos.find(s => s.soNumber === '8000001').id, 'so-8000001');
});

test('a viewer cannot import; a bad body is refused', async () => {
  assert.equal((await post(viewer, '/api/imports/orders', { kind: 'po', orders: [] })).status, 403);
  assert.equal((await post(op, '/api/imports/orders', { kind: 'po', orders: [{ items: [] }] })).status, 400);
});
