import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, token;
const PW = 'admin-password-1';
const post = (url, body) => fetch(`${srv.base}${url}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
const lock = (startBin, endBin, sessionId, sessionName = sessionId) =>
  post('/api/bins/lock', { startBin, endBin, sessionId, sessionName, username: 'admin' });

before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  await fs.writeFile(path.join(srv.dataDir, 'users.json'),
    JSON.stringify([{ id: 'u-admin', username: 'admin', passwordHash, fullName: 'A', role: 'admin', isActive: true }]));
  const res = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  });
  token = (await res.json()).token;
});
after(async () => { await srv.close(); });

test('a second session cannot lock an overlapping range; nothing is written', async () => {
  assert.equal((await lock('2', '10', 's-a')).status, 200);
  const clash = await lock('5', '6', 's-b');
  assert.equal(clash.status, 409);
  const body = await clash.json();
  assert.equal(body.conflicts.length, 1);
  assert.equal(body.conflicts[0].sessionName, 's-a');
  const locks = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_bin_locks.json'), 'utf8'));
  assert.deepEqual(locks.map(l => l.sessionId), ['s-a'], 'the refused session did not add a lock');
});

test('numeric ranges: 2-10 does not block 11-12, but does block 9-11', async () => {
  assert.equal((await lock('11', '12', 's-c')).status, 200);
  assert.equal((await lock('9', '11', 's-d')).status, 409);
});

test('a session can re-lock its own range without a conflict', async () => {
  assert.equal((await lock('2', '10', 's-a')).status, 200);
});

test('check-availability agrees with the lock endpoint', async () => {
  const res = await post('/api/bins/check-availability', { startBin: '5', endBin: '6', sessionId: 's-b' });
  assert.equal((await res.json()).available, false);
  const free = await post('/api/bins/check-availability', { startBin: '20', endBin: '30', sessionId: 's-b' });
  assert.equal((await free.json()).available, true);
});

test('after unlocking, the range can be locked by another session', async () => {
  assert.equal((await post('/api/bins/unlock', { sessionId: 's-a' })).status, 200);
  assert.equal((await lock('5', '6', 's-b')).status, 200);
});

test('concurrent lock attempts on the same range: exactly one wins', async () => {
  const attempts = await Promise.all(
    Array.from({ length: 8 }, (_, i) => lock('40', '45', `race-${i}`).then(r => r.status)));
  assert.equal(attempts.filter(s => s === 200).length, 1, `statuses: ${attempts}`);
  assert.equal(attempts.filter(s => s === 409).length, 7);
});
