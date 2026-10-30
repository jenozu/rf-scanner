import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startTestServer } from '../testing/helpers.js';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reset-admin.js');
let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

function run(dataDir, env = {}, args = []) {
  const clean = { ...process.env };
  delete clean.ADMIN_PASSWORD; delete clean.ADMIN_USERNAME;
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...clean, DATA_DIR: dataDir, ...env }, encoding: 'utf8',
  });
}

test('init-admin route no longer exists and creates no account', async () => {
  const res = await fetch(`${srv.base}/api/users/init-admin`, { method: 'POST' });
  assert.ok([401, 404].includes(res.status), `unexpected status ${res.status}`);
  await assert.rejects(fs.access(path.join(srv.dataDir, 'users.json')));
  const login = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' + '123' }),
  });
  assert.equal(login.status, 401);
});

test('setup script needs ADMIN_PASSWORD and rejects short ones', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-setup-'));
  assert.notEqual(run(dir).status, 0);
  assert.notEqual(run(dir, { ADMIN_PASSWORD: 'short' }).status, 0);
  await assert.rejects(fs.access(path.join(dir, 'users.json')));
});

test('setup script creates the first admin once, then refuses', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-setup-'));
  const ok = run(dir, { ADMIN_PASSWORD: 'a-long-password' });
  assert.equal(ok.status, 0, ok.stderr);
  const users = JSON.parse(await fs.readFile(path.join(dir, 'users.json'), 'utf8'));
  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'admin');
  assert.ok(users[0].passwordHash && !users[0].password);
  assert.notEqual(run(dir, { ADMIN_PASSWORD: 'another-password' }).status, 0);
});

test('--reset-password changes only that admin and keeps other users', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-setup-'));
  run(dir, { ADMIN_PASSWORD: 'a-long-password' });
  const file = path.join(dir, 'users.json');
  const users = JSON.parse(await fs.readFile(file, 'utf8'));
  users.push({ id: 'u2', username: 'op', role: 'operator', passwordHash: 'keep', isActive: true });
  await fs.writeFile(file, JSON.stringify(users));
  const before = users[0].passwordHash;
  assert.equal(run(dir, { ADMIN_PASSWORD: 'new-long-password' }, ['--reset-password']).status, 0);
  const after = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(after.length, 2);
  assert.notEqual(after[0].passwordHash, before);
  assert.equal(after[1].passwordHash, 'keep');
  assert.notEqual(run(dir, { ADMIN_USERNAME: 'nobody', ADMIN_PASSWORD: 'new-long-password' }, ['--reset-password']).status, 0);
});
