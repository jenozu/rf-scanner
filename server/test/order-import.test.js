import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';
import { applyOrderImport, validateOrderImport } from '../order-import.js';

const NOW = new Date('2026-11-06T15:00:00.000Z');
const user = { username: 'tester' };

// What the browser sends after reading a SAP file (see src/data/sap-import.ts).
const line = (n, item, qty, extra = {}) => ({ LineNumber: n, ItemCode: item, Description: `${item} desc`, OrderedQty: qty, Warehouse: '01', ...extra });
const po = (doc, items, extra = {}) => ({ poNumber: String(doc), vendor: 'ACME', cardCode: 'V1', expectedDate: '2026-07-01', items, ...extra });
const so = (doc, items, extra = {}) => ({ soNumber: String(doc), customer: 'BOB CO', cardCode: 'C1', dueDate: '2026-07-01', items, ...extra });
const importPO = (current, orders) => applyOrderImport(current, { kind: 'po', orders }, user, NOW);
const importSO = (current, orders) => applyOrderImport(current, { kind: 'so', orders }, user, NOW);
const clone = (v) => JSON.parse(JSON.stringify(v));

describe('first import', () => {
  test('creates orders with deterministic ids and DocNum:LineNumber keys, ignoring any id the browser sent', () => {
    const r = importPO(null, [po(410167, [line(0, 'A', 10), line(1, 'B', 3)], { id: 'po-1730000000000-0' })]);
    assert.equal(r.result.added, 1);
    const [order] = r.data;
    assert.equal(order.id, 'po-410167');
    assert.deepEqual(order.items.map((i) => i.LineKey), ['410167:0', '410167:1']);
    assert.equal(order.items[0].RemainingQty, 10);
    assert.equal(order.status, 'pending');
    assert.equal(order.items[0].Warehouse, '01');
  });

  test('normalises the warehouse (5 -> 05) and keeps it apart from the bin', () => {
    const r = importPO(null, [po(1, [line(0, 'A', 1, { Warehouse: 5 })])]);
    assert.equal(r.data[0].items[0].Warehouse, '05');
    assert.equal(r.data[0].items[0].BinCode, undefined);
  });

  test('computes status and remaining from what SAP already shows as received', () => {
    const r = importPO(null, [po(1, [line(0, 'A', 4, { ReceivedQty: 1 }), line(1, 'B', 2, { ReceivedQty: 2 })])]);
    assert.equal(r.data[0].status, 'receiving');
    assert.deepEqual(r.data[0].items.map((i) => i.RemainingQty), [3, 0]);
  });

  test('a sales order starts with a created date and keeps its due date', () => {
    const r = importSO(null, [so(5, [line(0, 'A', 2)])]);
    assert.equal(r.data[0].id, 'so-5');
    assert.equal(r.data[0].createdDate, '2026-11-06');
    assert.equal(r.data[0].dueDate, '2026-07-01');
  });
});

describe('importing the same file again', () => {
  test('changes nothing: second run reports every order unchanged and the stored data is identical', () => {
    const file = [po(1, [line(0, 'A', 10), line(1, 'B', 3)]), po(2, [line(4, 'C', 7)])];
    const first = importPO(null, clone(file));
    const second = importPO(clone(first.data), clone(file));
    assert.equal(second.result.added, 0);
    assert.equal(second.result.updated, 0);
    assert.equal(second.result.unchanged, 2);
    assert.deepEqual(second.data, first.data);
  });

  test('is the same for sales orders (the created date is not rewritten)', () => {
    const file = [so(7, [line(0, 'A', 2), line(1, 'A', 5)])];
    const first = applyOrderImport(null, { kind: 'so', orders: clone(file) }, user, new Date('2026-11-01T00:00:00Z'));
    const second = applyOrderImport(clone(first.data), { kind: 'so', orders: clone(file) }, user, NOW);
    assert.equal(second.result.unchanged, 1);
    assert.deepEqual(second.data, first.data);
    assert.equal(second.data[0].createdDate, '2026-11-01');
  });
});

describe('re-import updates open quantities and keeps history', () => {
  const base = () => importPO(null, [po(1, [line(0, 'A', 10), line(1, 'B', 3)])]).data;

  test('a changed ordered quantity updates; what the app already received is kept', () => {
    const stored = base();
    stored[0].items[0].ReceivedQty = 4; // received in the app
    stored[0].items[0].RemainingQty = 6;
    const r = importPO(stored, [po(1, [line(0, 'A', 12), line(1, 'B', 3)])]);
    assert.equal(r.result.updated, 1);
    const a = r.data[0].items[0];
    assert.equal(a.OrderedQty, 12);
    assert.equal(a.ReceivedQty, 4);
    assert.equal(a.RemainingQty, 8);
    assert.equal(r.data[0].status, 'receiving');
  });

  test('a receipt later posted in SAP is not counted twice (received = the larger of the two)', () => {
    const stored = base();
    stored[0].items[0].ReceivedQty = 4; // app received 4, not yet posted in SAP
    // SAP now shows those same 4 received (posted the goods receipt)
    const r = importPO(stored, [po(1, [line(0, 'A', 10, { ReceivedQty: 4 }), line(1, 'B', 3)])]);
    assert.equal(r.data[0].items[0].ReceivedQty, 4);
    assert.equal(r.data[0].items[0].RemainingQty, 6);
  });

  test('receipts SAP shows beyond what the app recorded are taken over', () => {
    const stored = base();
    stored[0].items[0].ReceivedQty = 4;
    const r = importPO(stored, [po(1, [line(0, 'A', 10, { ReceivedQty: 6 }), line(1, 'B', 3)])]);
    assert.equal(r.data[0].items[0].ReceivedQty, 6);
  });

  test('a delivered quantity picked in the app survives a sales-order re-import', () => {
    const stored = importSO(null, [so(9, [line(0, 'A', 10)])]).data;
    stored[0].items[0].DeliveredQty = 3;
    stored[0].items[0].RemainingQty = 7;
    stored[0].status = 'picking';
    const r = importSO(stored, [so(9, [line(0, 'A', 10)])]);
    assert.equal(r.data[0].items[0].DeliveredQty, 3);
    assert.equal(r.data[0].items[0].RemainingQty, 7);
    assert.equal(r.data[0].status, 'picking');
    assert.equal(r.result.unchanged, 1);
  });

  test('an ordered quantity cut below what was received leaves nothing open and is noted', () => {
    const stored = base();
    stored[0].items[0].ReceivedQty = 8;
    const r = importPO(stored, [po(1, [line(0, 'A', 5), line(1, 'B', 3)])]);
    assert.equal(r.data[0].items[0].ReceivedQty, 8);
    assert.equal(r.data[0].items[0].RemainingQty, 0);
    assert.ok(r.result.notes.some((n) => n.code === 'OVER_RECEIVED' && n.lineKey === '1:0'));
  });

  test('new header values from SAP replace old ones; blank values do not erase them', () => {
    const stored = base();
    const r = importPO(stored, [po(1, [line(0, 'A', 10), line(1, 'B', 3)], { vendor: 'ACME NEW', expectedDate: '' })]);
    assert.equal(r.data[0].vendor, 'ACME NEW');
    assert.equal(r.data[0].expectedDate, '2026-07-01');
  });

  test('a new SAP line is added and lines stay in LineNumber order', () => {
    const r = importPO(base(), [po(1, [line(0, 'A', 10), line(1, 'B', 3), line(2, 'C', 1)])]);
    assert.deepEqual(r.data[0].items.map((i) => i.LineKey), ['1:0', '1:1', '1:2']);
    assert.equal(r.result.lines.added, 1);
  });

  test('the same ItemCode on two lines stays two lines and updates each separately', () => {
    const first = importPO(null, [po(3, [line(0, 'DUP', 5), line(1, 'DUP', 3)])]).data;
    first[0].items[1].ReceivedQty = 2;
    const r = importPO(first, [po(3, [line(0, 'DUP', 6), line(1, 'DUP', 3)])]);
    assert.deepEqual(r.data[0].items.map((i) => [i.LineKey, i.OrderedQty, i.ReceivedQty ?? 0]), [['3:0', 6, 0], ['3:1', 3, 2]]);
  });
});

describe('lines SAP no longer lists', () => {
  test('are flagged closed, never deleted, and come back when SAP lists them again', () => {
    const stored = importPO(null, [po(1, [line(0, 'A', 10), line(1, 'B', 3)])]).data;
    stored[0].items[1].ReceivedQty = 3;
    const r1 = importPO(stored, [po(1, [line(0, 'A', 10)])]);
    assert.equal(r1.data[0].items.length, 2);
    assert.equal(r1.data[0].items[1].SapClosed, true);
    assert.equal(r1.data[0].items[1].ReceivedQty, 3);
    assert.equal(r1.result.lines.closed, 1);
    const r2 = importPO(r1.data, [po(1, [line(0, 'A', 10), line(1, 'B', 3)])]);
    assert.equal(r2.data[0].items[1].SapClosed, undefined);
    assert.equal(r2.result.lines.reopened, 1);
  });

  test('an order that is not in the file at all is left alone', () => {
    const stored = importPO(null, [po(1, [line(0, 'A', 1)]), po(2, [line(0, 'B', 1)])]).data;
    const r = importPO(stored, [po(1, [line(0, 'A', 1)])]);
    assert.equal(r.data.length, 2);
    assert.equal(r.data[1].items[0].SapClosed, undefined);
  });

  test('the status ignores closed lines', () => {
    const stored = importPO(null, [po(1, [line(0, 'A', 2, { ReceivedQty: 2 }), line(1, 'B', 3)])]).data;
    const r = importPO(stored, [po(1, [line(0, 'A', 2, { ReceivedQty: 2 })])]);
    assert.equal(r.data[0].status, 'completed');
  });
});

describe('bins on re-import', () => {
  test('a bin chosen in the app stays while SAP still has no real bin', () => {
    const stored = importSO(null, [so(1, [line(0, 'A', 2)])]).data;
    Object.assign(stored[0].items[0], { BinCode: '01-RACK-A', BinAssignedBy: 'sam', BinAssignedAt: '2026-11-05T10:00:00Z' });
    const r = importSO(stored, [so(1, [line(0, 'A', 2)])]);
    assert.equal(r.data[0].items[0].BinCode, '01-RACK-A');
    assert.equal(r.data[0].items[0].BinAssignedBy, 'sam');
    assert.equal(r.result.unchanged, 1);
  });

  test('a bin that SAP now supplies replaces the one chosen in the app', () => {
    const stored = importSO(null, [so(1, [line(0, 'A', 2)])]).data;
    Object.assign(stored[0].items[0], { BinCode: '01-RACK-A', BinAssignedBy: 'sam', BinAssignedAt: '2026-11-05T10:00:00Z' });
    const r = importSO(stored, [so(1, [line(0, 'A', 2, { BinCode: '01-RACK-Z' })])]);
    assert.equal(r.data[0].items[0].BinCode, '01-RACK-Z');
    assert.equal(r.data[0].items[0].BinAssignedBy, undefined);
  });

  test('SAP\'s placeholder bin is kept when there is nothing better, so the screen can say so', () => {
    const r = importSO(null, [so(1, [line(0, 'A', 2, { BinCode: '01-SYSTEM-BIN-LOCATION' })])]);
    assert.equal(r.data[0].items[0].BinCode, '01-SYSTEM-BIN-LOCATION');
  });
});

describe('conflicts are reported, never guessed', () => {
  test('an item code changed on a line that has history leaves that line untouched', () => {
    const stored = importPO(null, [po(1, [line(0, 'A', 10), line(1, 'B', 3)])]).data;
    stored[0].items[0].ReceivedQty = 4;
    const r = importPO(stored, [po(1, [line(0, 'OTHER', 12), line(1, 'B', 5)])]);
    assert.equal(r.data[0].items[0].ItemCode, 'A');
    assert.equal(r.data[0].items[0].OrderedQty, 10);
    assert.equal(r.data[0].items[1].OrderedQty, 5); // the rest of the order still updates
    assert.ok(r.result.conflicts.some((c) => c.code === 'ITEM_CHANGED' && c.lineKey === '1:0'));
  });

  test('an item code changed on an untouched line just updates', () => {
    const stored = importPO(null, [po(1, [line(0, 'A', 10)])]).data;
    const r = importPO(stored, [po(1, [line(0, 'NEW', 10)])]);
    assert.equal(r.data[0].items[0].ItemCode, 'NEW');
    assert.equal(r.result.conflicts.length, 0);
  });

  test('two stored orders with the same number are not touched and no third is created', () => {
    const a = importPO(null, [po(1, [line(0, 'A', 1)])]).data[0];
    const b = { ...clone(a), id: 'po-1730000000000-3' };
    const r = importPO([a, b], [po(1, [line(0, 'A', 99)])]);
    assert.equal(r.data.length, 2);
    assert.equal(r.data[0].items[0].OrderedQty, 1);
    assert.ok(r.result.conflicts.some((c) => c.code === 'DUPLICATE_ORDERS'));
  });
});

describe('orders imported before line keys existed', () => {
  const legacy = (items, id = 'po-1730000000000-0') => ({
    id, poNumber: '410167', vendor: 'ACME', items, status: 'pending', expectedDate: '2026-07-01',
  });
  const old = (n, item, qty, extra = {}) => ({ LineNumber: n, ItemCode: item, Description: item, OrderedQty: qty, ReceivedQty: 0, RemainingQty: qty, ...extra });

  test('are found by order number, keep their id, and get line keys: no second copy is created', () => {
    const r = importPO([legacy([old(0, 'A', 10, { ReceivedQty: 4 }), old(1, 'B', 3)])], [po(410167, [line(0, 'A', 10), line(1, 'B', 3)])]);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].id, 'po-1730000000000-0');
    assert.deepEqual(r.data[0].items.map((i) => i.LineKey), ['410167:0', '410167:1']);
    assert.equal(r.data[0].items[0].ReceivedQty, 4);
  });

  test('with repeated line numbers and history: reported as a conflict and left unchanged', () => {
    const stored = [legacy([old(0, 'A', 10, { ReceivedQty: 4 }), old(0, 'A', 3)])];
    const r = importPO(clone(stored), [po(410167, [line(0, 'A', 10), line(1, 'A', 3)])]);
    assert.deepEqual(r.data, stored);
    assert.ok(r.result.conflicts.some((c) => c.code === 'LEGACY_ORDER_UNMATCHED'));
  });

  test('with repeated line numbers and no history: replaced by the lines from the file', () => {
    const r = importPO([legacy([old(0, 'A', 10), old(0, 'A', 3)])], [po(410167, [line(0, 'A', 10), line(1, 'A', 3)])]);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].id, 'po-1730000000000-0');
    assert.deepEqual(r.data[0].items.map((i) => i.LineKey), ['410167:0', '410167:1']);
    assert.equal(r.result.conflicts.length, 0);
  });
});

describe('validation (the server does not trust the browser)', () => {
  const ok = { kind: 'po', orders: [po(1, [line(0, 'A', 1)])] };
  const bad = (patch) => validateOrderImport({ ...ok, ...patch });

  test('accepts a good payload', () => assert.equal(validateOrderImport(ok), null));
  test('needs a kind of po or so', () => assert.equal(bad({ kind: 'x' }).status, 400));
  test('needs at least one order', () => assert.equal(bad({ orders: [] }).status, 400));
  test('an order needs a number and lines', () => {
    assert.equal(bad({ orders: [po('', [line(0, 'A', 1)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [])] }).status, 400);
  });
  test('a line needs an item code, a whole line number and a quantity above zero', () => {
    assert.equal(bad({ orders: [po(1, [line(0, '', 1)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [line(-1, 'A', 1)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [line(0.5, 'A', 1)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [line(0, 'A', 0)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [line(0, 'A', '5')])] }).status, 400);
  });
  test('the same line or order twice in one payload is refused', () => {
    assert.equal(bad({ orders: [po(1, [line(0, 'A', 1), line(0, 'B', 1)])] }).status, 400);
    assert.equal(bad({ orders: [po(1, [line(0, 'A', 1)]), po('1', [line(0, 'A', 1)])] }).status, 400);
  });
});

// ---- Through the real HTTP API: permissions and simultaneous imports -------------------------

describe('POST /api/imports/orders', () => {
  let srv, op, viewer;
  const PW = 'operator-pass-1';
  const call = (token, body) => fetch(`${srv.base}/api/imports/orders`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  });
  const read = async (key) => JSON.parse(await fs.readFile(path.join(srv.dataDir, `${key}.json`), 'utf8'));
  const login = async (username) => (await (await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: PW }),
  })).json()).token;

  before(async () => {
    srv = await startTestServer();
    const passwordHash = await bcrypt.hash(PW, 4);
    const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
    await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([mk('u1', 'op', 'operator'), mk('u2', 'view', 'viewer')]));
    op = await login('op');
    viewer = await login('view');
  });
  after(async () => { await srv.close(); });

  test('a viewer cannot import; no token is refused', async () => {
    assert.equal((await call(viewer, { kind: 'po', orders: [po(1, [line(0, 'A', 1)])] })).status, 403);
    const res = await fetch(`${srv.base}/api/imports/orders`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('a bad payload is a 400 and writes nothing', async () => {
    const res = await call(op, { kind: 'po', orders: [po(1, [line(0, 'A', 0)])] });
    assert.equal(res.status, 400);
    await assert.rejects(read('rf_purchase_orders'));
  });

  test('the same file imported on 8 devices at the same moment creates each order exactly once', async () => {
    const file = Array.from({ length: 12 }, (_, i) => po(500 + i, [line(0, `P${i}`, 5), line(1, `Q${i}`, 2)]));
    const results = await Promise.all(Array.from({ length: 8 }, () => call(op, { kind: 'po', orders: file })));
    const bodies = await Promise.all(results.map((r) => r.json()));
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(bodies.reduce((n, b) => n + b.added, 0), 12, 'exactly 12 additions across all 8 requests');
    assert.equal(bodies.reduce((n, b) => n + b.unchanged, 0), 12 * 7);
    const stored = await read('rf_purchase_orders');
    assert.equal(stored.length, 12);
    assert.equal(new Set(stored.map((o) => o.id)).size, 12);
  });

  test('two devices importing overlapping files at the same moment end with one copy of each order', async () => {
    const a = [so(700, [line(0, 'A', 1)]), so(701, [line(0, 'B', 1)])];
    const b = [so(701, [line(0, 'B', 1)]), so(702, [line(0, 'C', 1)])];
    const rs = await Promise.all([call(op, { kind: 'so', orders: a }), call(op, { kind: 'so', orders: b })]);
    assert.ok(rs.every((r) => r.status === 200));
    const stored = await read('rf_sales_orders');
    assert.deepEqual(stored.map((o) => o.soNumber).sort(), ['700', '701', '702']);
  });

  test('importing a file does not disturb picks made between two imports', async () => {
    await call(op, { kind: 'so', orders: [so(800, [line(0, 'A', 10)])] });
    const file = path.join(srv.dataDir, 'rf_sales_orders.json');
    const sos = JSON.parse(await fs.readFile(file, 'utf8'));
    const target = sos.find((s) => s.id === 'so-800');
    target.items[0].DeliveredQty = 6; target.items[0].RemainingQty = 4; target.status = 'picking';
    await fs.writeFile(file, JSON.stringify(sos));
    const res = await call(op, { kind: 'so', orders: [so(800, [line(0, 'A', 10)])] });
    assert.equal((await res.json()).unchanged, 1);
    const after = (await read('rf_sales_orders')).find((s) => s.id === 'so-800');
    assert.equal(after.items[0].DeliveredQty, 6);
  });
});
