import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, adminToken, operatorToken;
const PW = 'password-123';
const call = (token, method, url, body) => fetch(`${srv.base}${url}`, {
  method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const login = async (username) => (await (await fetch(`${srv.base}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: PW }),
})).json()).token;

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([
    { id: 'u-admin', username: 'admin', passwordHash, fullName: 'A', role: 'admin', isActive: true },
    { id: 'u-op', username: 'picker', passwordHash, fullName: 'P', role: 'operator', isActive: true },
  ]));
  const line = { ItemCode: 'A', OrderedQty: 5, DeliveredQty: 0, RemainingQty: 5, BinCode: '01-0102', Warehouse: '01', LineKey: '1:0' };
  await fs.writeFile(path.join(srv.dataDir, 'rf_sales_orders.json'), JSON.stringify([
    { id: 's1', soNumber: 'SO-1', status: 'pending', items: [line] },
    { id: 's2', soNumber: 'SO-2', status: 'pending', items: [{ ...line, LineKey: '2:0' }] },
  ]));
  adminToken = await login('admin');
  operatorToken = await login('picker');
});
after(async () => { await srv.close(); });

test('only an admin can create a wave; an operator is refused', async () => {
  assert.equal((await call(operatorToken, 'POST', '/api/waves/create', { soIds: ['s1'] })).status, 403);
  const res = await call(adminToken, 'POST', '/api/waves/create', { soIds: ['s1', 's2'] });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.wave.waveNumber, 'W-001');
  const waves = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_pick_waves.json'), 'utf8'));
  assert.equal(waves.length, 1);
});

test('an order already in a wave cannot go into a second one', async () => {
  const res = await call(adminToken, 'POST', '/api/waves/create', { soIds: ['s2'] });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'SO_IN_WAVE');
});

test('the wave can be read by a signed-in user through the shared data endpoint', async () => {
  const res = await call(operatorToken, 'GET', '/api/data/rf_pick_waves');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, 1);
});

test('a wave with no picks can be deleted by an admin, not an operator', async () => {
  const waves = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_pick_waves.json'), 'utf8'));
  const id = waves[0].id;
  assert.equal((await call(operatorToken, 'POST', '/api/waves/delete', { id })).status, 403);
  assert.equal((await call(adminToken, 'POST', '/api/waves/delete', { id })).status, 200);
});

test('after a pick in a wave, the wave cannot be deleted', async () => {
  await fs.writeFile(path.join(srv.dataDir, 'rf_bins.json'), JSON.stringify([
    { BinCode: '01-0102', Items: [{ ItemCode: 'A', Quantity: 50 }] },
  ]));
  const made = await (await call(adminToken, 'POST', '/api/waves/create', { soIds: ['s1'] })).json();
  const id = made.wave.id;
  const pick = await call(operatorToken, 'POST', '/api/ops/pick-so',
    { soId: 's1', lineKey: '1:0', qty: 1, txnId: 'wave-pick-1', scannedCode: 'A' });
  assert.equal(pick.status, 200);
  const waves = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_pick_waves.json'), 'utf8'));
  assert.deepEqual(waves.find((w) => w.id === id).picked, ['s1|1:0']);
  const del = await call(adminToken, 'POST', '/api/waves/delete', { id });
  assert.equal(del.status, 409);
  assert.equal((await del.json()).code, 'WAVE_HAS_PICKS');
});
