import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, token;
before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash('operator-pass-1', 4);
  await fs.writeFile(path.join(srv.dataDir, 'users.json'),
    JSON.stringify([{ id: 'u1', username: 'op', passwordHash, fullName: 'Op', role: 'operator', isActive: true }]));
  const res = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'op', password: 'operator-pass-1' }),
  });
  token = (await res.json()).token;
});
after(async () => { await srv.close(); });

const call = (method, key, body) => fetch(`${srv.base}/api/data/${key}`, {
  method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});

for (const key of ['rf_receiving_txns', 'rf_cycle_count_txns', 'rf_temporary_locations']) {
  test(`${key}: empty read, save, read back`, async () => {
    assert.deepEqual(await (await call('GET', key)).json(), []);
    const rows = [{ id: 't1', qty: 3 }];
    assert.equal((await call('POST', key, { data: rows })).status, 200);
    assert.deepEqual(await (await call('GET', key)).json(), rows);
  });
}

test('rf_master_meta: empty object by default, save, read back', async () => {
  assert.deepEqual(await (await call('GET', 'rf_master_meta')).json(), {});
  const meta = { fileName: 'm.xlsx', itemCount: 5 };
  assert.equal((await call('POST', 'rf_master_meta', { data: meta })).status, 200);
  assert.deepEqual(await (await call('GET', 'rf_master_meta')).json(), meta);
});

test('unknown keys are still rejected with 400', async () => {
  assert.equal((await call('GET', 'rf_not_a_key')).status, 400);
  assert.equal((await call('POST', 'rf_not_a_key', { data: [] })).status, 400);
  assert.equal((await call('GET', '..%2Fusers')).status, 400);
});

test('data routes still require a token', async () => {
  assert.equal((await fetch(`${srv.base}/api/data/rf_receiving_txns`)).status, 401);
});
