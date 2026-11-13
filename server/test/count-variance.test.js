import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, adminToken, operatorToken;
const PW = 'password-123';

const call = (token, method, url, body) => fetch(`${srv.base}${url}`, {
  method,
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const login = async (username) => (await (await fetch(`${srv.base}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password: PW }),
})).json()).token;
const readJSON = async (name) => JSON.parse(await fs.readFile(path.join(srv.dataDir, `${name}.json`), 'utf8'));
const heldQty = async (binCode, itemCode) => {
  const bins = await readJSON('rf_bins');
  const bin = bins.find(b => b.BinCode === binCode);
  return bin?.Items.find(i => i.ItemCode === itemCode)?.Quantity;
};
const count = (binCode, itemCode, countedQty, extra = {}) => ({ binCode, itemCode, description: `${itemCode} desc`, countedQty, ...extra });

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([
    { id: 'u-admin', username: 'admin', passwordHash, fullName: 'A', role: 'admin', isActive: true },
    { id: 'u-op', username: 'picker', passwordHash, fullName: 'P', role: 'operator', isActive: true },
  ]));
  await fs.writeFile(path.join(srv.dataDir, 'rf_bins.json'), JSON.stringify([
    { BinCode: '01-A-1', Zone: 'Main', Capacity: 100, Status: 'active',
      Items: [{ ItemCode: 'ITEM-1', Description: 'Widget', Quantity: 10 }] },
  ]));
  adminToken = await login('admin');
  operatorToken = await login('picker');
});
after(async () => { await srv.close(); });

test('a count that matches the bin is logged and changes nothing', async () => {
  const res = await call(operatorToken, 'POST', '/api/counts/submit', { counts: [count('01-A-1', 'ITEM-1', 10)] });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.matched, 1);
  assert.equal(body.pending, 0);
  assert.equal(await heldQty('01-A-1', 'ITEM-1'), 10);
});

test('a count that differs is queued, and the bin is not changed', async () => {
  const res = await call(operatorToken, 'POST', '/api/counts/submit', {
    counts: [count('01-A-1', 'ITEM-1', 7, { expectedQty: 10, sessionId: 's1', sessionName: 'Monday' })],
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.pending, 1);
  assert.equal(await heldQty('01-A-1', 'ITEM-1'), 10, 'stock unchanged until approval');
  const [v] = (await readJSON('rf_count_variances'));
  assert.equal(v.status, 'pending');
  assert.equal(v.variance, -3);
  assert.equal(v.submittedBy, 'picker');
  assert.equal(v.sessionName, 'Monday');
});

test('a newer count for the same bin and item replaces the pending one', async () => {
  await call(operatorToken, 'POST', '/api/counts/submit', { counts: [count('01-A-1', 'ITEM-1', 8)] });
  const pending = (await readJSON('rf_count_variances')).filter(v => v.status === 'pending');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].countedQty, 8);
});

test('only an admin can approve or reject', async () => {
  const [v] = (await readJSON('rf_count_variances')).filter(x => x.status === 'pending');
  const res = await call(operatorToken, 'POST', '/api/counts/variances/decide', { id: v.id, decision: 'approve' });
  assert.equal(res.status, 403);
  assert.equal(await heldQty('01-A-1', 'ITEM-1'), 10);
});

test('reject leaves the bin alone and cannot be decided twice', async () => {
  const [v] = (await readJSON('rf_count_variances')).filter(x => x.status === 'pending');
  assert.equal((await call(adminToken, 'POST', '/api/counts/variances/decide', { id: v.id, decision: 'reject' })).status, 200);
  assert.equal(await heldQty('01-A-1', 'ITEM-1'), 10);
  assert.equal((await call(adminToken, 'POST', '/api/counts/variances/decide', { id: v.id, decision: 'approve' })).status, 409);
});

test('approve applies the counted quantity and records whether stock moved since the count', async () => {
  await call(operatorToken, 'POST', '/api/counts/submit', { counts: [count('01-A-1', 'ITEM-1', 6)] });
  const [v] = (await readJSON('rf_count_variances')).filter(x => x.status === 'pending');
  const res = await call(adminToken, 'POST', '/api/counts/variances/decide', { id: v.id, decision: 'approve' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.newQty, 6);
  assert.equal(body.changedSinceCount, false);
  assert.equal(await heldQty('01-A-1', 'ITEM-1'), 6);
});

test('a variance on a bin that does not exist yet creates the bin when approved', async () => {
  await call(operatorToken, 'POST', '/api/counts/submit', { counts: [count('02-B-9', 'ITEM-2', 4)] });
  const [v] = (await readJSON('rf_count_variances')).filter(x => x.status === 'pending' && x.binCode === '02-B-9');
  assert.equal(v.heldQty, 0);
  assert.equal((await call(adminToken, 'POST', '/api/counts/variances/decide', { id: v.id, decision: 'approve' })).status, 200);
  assert.equal(await heldQty('02-B-9', 'ITEM-2'), 4);
});

test('an unknown variance id is a 404, and bad counts are refused', async () => {
  assert.equal((await call(adminToken, 'POST', '/api/counts/variances/decide', { id: 'nope', decision: 'approve' })).status, 404);
  assert.equal((await call(operatorToken, 'POST', '/api/counts/submit', { counts: [] })).status, 400);
  assert.equal((await call(operatorToken, 'POST', '/api/counts/submit', { counts: [count('01-A-1', 'ITEM-1', -1)] })).status, 400);
});
