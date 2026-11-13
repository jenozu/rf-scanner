import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv, token;
before(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash('password-123', 4);
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify([
    { id: 'u-op', username: 'picker', passwordHash, fullName: 'P', role: 'operator', isActive: true },
  ]));
  await fs.writeFile(path.join(srv.dataDir, 'rf_purchase_orders.json'), JSON.stringify([{ id: 'p1', status: 'receiving' }]));
  await fs.writeFile(path.join(srv.dataDir, 'rf_count_variances.json'), JSON.stringify([{ id: 'v1', status: 'pending' }]));
  token = (await (await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'picker', password: 'password-123' }),
  })).json()).token;
});
after(async () => { await srv.close(); });

test('the dashboard is served from the server to any signed-in user, with missing files as zero', async () => {
  const res = await fetch(`${srv.base}/api/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.stats.receivingPOs, 1);
  assert.equal(d.stats.pendingApprovals, 1);
  assert.equal(d.stats.totalBins, 0);
  assert.deepEqual(d.timeline, []);
});

test('the dashboard needs a signed-in user', async () => {
  assert.equal((await fetch(`${srv.base}/api/dashboard`)).status, 401);
});
