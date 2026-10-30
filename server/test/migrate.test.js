import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, admin, op, viewer;
const PW = 'migration-pass-1';
const call = (token, method, url, body) => fetch(`${srv.base}${url}`, {
  method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const read = async (key) => JSON.parse(await fs.readFile(path.join(srv.dataDir, `${key}.json`), 'utf8'));
const write = (key, data) => fs.writeFile(path.join(srv.dataDir, `${key}.json`), JSON.stringify(data));
const login = async (username) => (await (await call(null, 'POST', '/api/auth/login', { username, password: PW })).json()).token;

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
  await write('users', [mk('u1', 'boss', 'admin'), mk('u2', 'op', 'operator'), mk('u3', 'view', 'viewer')]);
  admin = await login('boss'); op = await login('op'); viewer = await login('view');
});
after(async () => { await srv.close(); });

test('only admins can use the migration routes', async () => {
  for (const [token, expected] of [[null, 401], [op, 403], [viewer, 403]]) {
    assert.equal((await call(token, 'GET', '/api/migrate/status')).status, expected);
    assert.equal((await call(token, 'POST', '/api/migrate/browser-data', { collections: {} })).status, expected);
  }
  assert.equal((await call(admin, 'GET', '/api/migrate/status')).status, 200);
});

test('status reports how many items the server holds per collection', async () => {
  await write('rf_bins', [{ BinCode: 'A' }, { BinCode: 'B' }]);
  const { counts } = await (await call(admin, 'GET', '/api/migrate/status')).json();
  assert.equal(counts.rf_bins, 2);
  assert.equal(counts.rf_purchase_orders, 0);
  assert.equal(counts.rf_master_meta, 0);
});

test('fills empty collections, leaves non-empty ones alone by default, and never touches anything else', async () => {
  await write('rf_bins', [{ BinCode: 'SERVER' }]);
  await write('rf_waves', []);
  const res = await call(admin, 'POST', '/api/migrate/browser-data', {
    collections: {
      rf_bins: [{ BinCode: 'BROWSER' }],
      rf_purchase_orders: [{ id: 'po1' }],
      rf_master_meta: { sourceFile: 'm.xlsx' },
      rf_waves: [],
      rf_orders: [],
    },
  });
  assert.equal(res.status, 200);
  const status = Object.fromEntries((await res.json()).results.map(r => [r.key, r.status]));
  assert.deepEqual(status, {
    rf_bins: 'skipped-not-empty', rf_master_meta: 'uploaded', rf_orders: 'skipped-empty-browser',
    rf_purchase_orders: 'uploaded', rf_waves: 'skipped-empty-browser',
  });
  assert.deepEqual(await read('rf_bins'), [{ BinCode: 'SERVER' }]);
  assert.deepEqual(await read('rf_purchase_orders'), [{ id: 'po1' }]);
  assert.deepEqual(await read('rf_master_meta'), { sourceFile: 'm.xlsx' });
});

test('running it again changes nothing', async () => {
  const before = await read('rf_purchase_orders');
  const res = await call(admin, 'POST', '/api/migrate/browser-data', {
    collections: { rf_purchase_orders: [{ id: 'other' }, { id: 'again' }] },
  });
  assert.equal((await res.json()).results[0].status, 'skipped-not-empty');
  assert.deepEqual(await read('rf_purchase_orders'), before);
});

test('replace is opt-in per collection and saves a backup of the old server copy first', async () => {
  await write('rf_sales_orders', [{ id: 'old', soNumber: '1' }]);
  await write('rf_cycle_counts', [{ id: 'keep' }]);
  const res = await call(admin, 'POST', '/api/migrate/browser-data', {
    collections: { rf_sales_orders: [{ id: 'new', soNumber: '1', progress: 5 }], rf_cycle_counts: [{ id: 'other' }] },
    replace: ['rf_sales_orders'],
  });
  const results = Object.fromEntries((await res.json()).results.map(r => [r.key, r]));
  assert.equal(results.rf_sales_orders.status, 'replaced');
  assert.equal(results.rf_cycle_counts.status, 'skipped-not-empty');
  assert.deepEqual(await read('rf_sales_orders'), [{ id: 'new', soNumber: '1', progress: 5 }]);
  const backup = JSON.parse(await fs.readFile(path.join(srv.dataDir, results.rf_sales_orders.backup), 'utf8'));
  assert.deepEqual(backup, [{ id: 'old', soNumber: '1' }]);
  assert.deepEqual(await read('rf_cycle_counts'), [{ id: 'keep' }]);
});

test('an activity log entry records who moved what', async () => {
  const logs = await read('rf_activity_logs');
  assert.ok(logs.length >= 1);
  assert.equal(logs[0].username, 'boss');
  assert.match(logs[0].details, /rf_/);
});

test('bad requests are refused and change nothing', async () => {
  const snapshot = await read('rf_purchase_orders');
  for (const body of [
    {},
    { collections: [] },
    { collections: { rf_users: [] } },
    { collections: { users: [{ id: 1 }] } },
    { collections: { rf_bins: { not: 'a list' } } },
    { collections: { rf_master_meta: [1] } },
    { collections: { rf_bins: [] }, replace: ['rf_orders'] },
    { collections: { rf_bins: [] }, replace: 'rf_bins' },
  ]) {
    assert.equal((await call(admin, 'POST', '/api/migrate/browser-data', body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual(await read('rf_purchase_orders'), snapshot);
});

test('a bad collection anywhere in the request means nothing is written', async () => {
  await write('rf_waves', []);
  const res = await call(admin, 'POST', '/api/migrate/browser-data', {
    collections: { rf_waves: [{ id: 'w' }], rf_bins: 'oops' },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await read('rf_waves'), []);
});
