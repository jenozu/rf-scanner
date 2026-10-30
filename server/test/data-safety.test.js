import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, token;
const PW = 'admin-password-1';
const headers = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` });
const call = (method, url, body) => fetch(`${srv.base}${url}`, {
  method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body),
});

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

test('GET returns X-Revision; a save with the current revision succeeds and a stale one gets 409', async () => {
  const first = await call('GET', '/api/data/rf_orders');
  const rev0 = first.headers.get('x-revision');
  assert.equal(rev0, 'none');
  const save1 = await call('POST', '/api/data/rf_orders', { data: [{ id: 'o1' }], baseRevision: rev0 });
  assert.equal(save1.status, 200);
  const rev1 = (await save1.json()).revision;
  assert.equal((await call('GET', '/api/data/rf_orders')).headers.get('x-revision'), rev1);

  // Two clients both loaded rev1; the first saves, the second must be refused.
  const winner = await call('POST', '/api/data/rf_orders', { data: [{ id: 'o1' }, { id: 'o2' }], baseRevision: rev1 });
  assert.equal(winner.status, 200);
  const loser = await call('POST', '/api/data/rf_orders', { data: [{ id: 'stale' }], baseRevision: rev1 });
  assert.equal(loser.status, 409);
  assert.ok((await loser.json()).currentRevision);
  assert.deepEqual((await (await call('GET', '/api/data/rf_orders')).json()).map(o => o.id), ['o1', 'o2']);
});

test('saves without baseRevision still work (existing pages)', async () => {
  assert.equal((await call('POST', '/api/data/rf_waves', { data: [{ id: 'w1' }] })).status, 200);
  assert.equal((await call('POST', '/api/data/rf_waves', { data: [{ id: 'w2' }] })).status, 200);
  assert.deepEqual(await (await call('GET', '/api/data/rf_waves')).json(), [{ id: 'w2' }]);
});

test('15 users created in parallel are all kept', async () => {
  const results = await Promise.all(Array.from({ length: 15 }, (_, i) =>
    call('POST', '/api/users', { username: `par${i}`, password: 'parallel-pass-1', fullName: `P${i}`, role: 'operator' })));
  assert.ok(results.every(r => r.status === 201));
  const users = await (await call('GET', '/api/users')).json();
  assert.equal(users.length, 16);
});

test('the same username created twice in parallel only succeeds once', async () => {
  const results = await Promise.all([1, 2, 3].map(() =>
    call('POST', '/api/users', { username: 'dupe', password: 'parallel-pass-1', fullName: 'D', role: 'operator' })));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400, 400]);
});

test('logins in parallel with an admin edit do not undo the edit', async () => {
  const created = await (await call('POST', '/api/users', { username: 'edited', password: 'parallel-pass-1', fullName: 'Before', role: 'operator' })).json();
  const logins = Array.from({ length: 8 }, () => fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW }),
  }));
  const edit = call('PUT', `/api/users/${created.id}`, { fullName: 'After' });
  await Promise.all([...logins, edit]);
  const users = await (await call('GET', '/api/users')).json();
  assert.equal(users.find(u => u.id === created.id).fullName, 'After');
});

test('20 bin locks taken in parallel are all recorded', async () => {
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => call('POST', '/api/bins/lock', {
    startBin: `A-${i}`, endBin: `A-${i}`, sessionId: `s${i}`, sessionName: `S${i}`, username: 'admin',
  })));
  assert.ok(results.every(r => r.status === 200));
  const locks = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_bin_locks.json'), 'utf8'));
  assert.equal(locks.length, 20);
  await Promise.all(Array.from({ length: 10 }, (_, i) => call('POST', '/api/bins/unlock', { sessionId: `s${i}` })));
  assert.equal(JSON.parse(await fs.readFile(path.join(srv.dataDir, 'rf_bin_locks.json'), 'utf8')).length, 10);
});

test('no temp files are left in the data folder', async () => {
  const names = await fs.readdir(srv.dataDir);
  assert.deepEqual(names.filter(n => n.endsWith('.tmp')), []);
});
