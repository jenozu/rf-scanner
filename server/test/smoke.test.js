import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../testing/helpers.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('health endpoint responds ok', async () => {
  const res = await fetch(`${srv.base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('user list requires a token', async () => {
  const res = await fetch(`${srv.base}/api/users`);
  assert.equal(res.status, 401);
});
