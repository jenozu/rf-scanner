import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, viewer, operator, inactive;
const PW = 'viewer-role-pass-1';
const call = (token, method, url, body) => fetch(`${srv.base}${url}`, {
  method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const login = async (username) => (await (await call(null, 'POST', '/api/auth/login', { username, password: PW })).json()).token;

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role, isActive = true) => ({ id, username, passwordHash, fullName: username, role, isActive });
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([mk('u1', 'view', 'viewer'), mk('u2', 'oper', 'operator'), mk('u3', 'gone', 'operator')]));
  viewer = await login('view'); operator = await login('oper'); inactive = await login('gone');
  // deactivate after the token was issued: the old token must stop working for writes
  const users = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'users.json'), 'utf8'));
  users.find(u => u.id === 'u3').isActive = false;
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify(users));
});
after(async () => { await srv.close(); });

test('a viewer can read data but cannot write it through the old data route', async () => {
  assert.equal((await call(viewer, 'GET', '/api/data/rf_orders')).status, 200);
  const write = await call(viewer, 'POST', '/api/data/rf_orders', { data: [{ id: 'x' }] });
  assert.equal(write.status, 403);
  assert.equal((await call(operator, 'GET', '/api/data/rf_orders')).status, 200);
  assert.deepEqual(await (await call(operator, 'GET', '/api/data/rf_orders')).json(), []); // nothing was written
});

test('an operator can still write data', async () => {
  assert.equal((await call(operator, 'POST', '/api/data/rf_orders', { data: [{ id: 'ok' }] })).status, 200);
});

test('a viewer cannot take or release bin locks, but can check availability', async () => {
  const lock = { startBin: 'A', endBin: 'B', sessionId: 's1', sessionName: 'S', username: 'view' };
  assert.equal((await call(viewer, 'POST', '/api/bins/lock', lock)).status, 403);
  assert.equal((await call(viewer, 'POST', '/api/bins/unlock', { sessionId: 's1' })).status, 403);
  assert.equal((await call(viewer, 'POST', '/api/bins/check-availability', { startBin: 'A', endBin: 'B', sessionId: 's1' })).status, 200);
  assert.equal((await call(operator, 'POST', '/api/bins/lock', lock)).status, 200);
});

test('a viewer cannot create shipments (they create real carrier labels)', async () => {
  assert.equal((await call(viewer, 'POST', '/api/shipping/shipments/create', { orderId: 'o1' })).status, 403);
  assert.equal((await call(viewer, 'POST', '/api/shipping/shipments/batch', { orderIds: ['o1'] })).status, 403);
  assert.equal((await call(null, 'POST', '/api/shipping/shipments/create', { orderId: 'o1' })).status, 401);
});

test('a deactivated user\'s existing token can no longer write', async () => {
  assert.equal((await call(inactive, 'POST', '/api/data/rf_orders', { data: [] })).status, 403);
});
