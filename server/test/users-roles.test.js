import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv;
const PW = 'pass1234';

async function seed() {
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role, extra = {}) => ({
    id, username, passwordHash, fullName: username, role, isActive: true, ...extra,
  });
  await fs.writeFile(
    path.join(srv.dataDir, 'users.json'),
    JSON.stringify([mk('u-admin', 'admin', 'admin'), mk('u-op', 'op', 'operator'), mk('u-op2', 'op2', 'operator')]),
  );
}

async function login(username) {
  const res = await fetch(`${srv.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: PW }),
  });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}

function call(method, url, token, body) {
  return fetch(`${srv.base}${url}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('operator cannot list, create, or delete users', async () => {
  await seed();
  const op = await login('op');
  assert.equal((await call('GET', '/api/users', op)).status, 403);
  assert.equal((await call('POST', '/api/users', op, { username: 'x1', password: 'abc1234567', fullName: 'X', role: 'admin' })).status, 403);
  assert.equal((await call('DELETE', '/api/users/u-admin', op)).status, 403);
  assert.equal((await call('DELETE', '/api/users/u-op2', op)).status, 403);
});

test('operator cannot promote self or edit others', async () => {
  await seed();
  const op = await login('op');
  assert.equal((await call('PUT', '/api/users/u-op', op, { role: 'admin' })).status, 403);
  assert.equal((await call('PUT', '/api/users/u-op2', op, { fullName: 'hacked' })).status, 403);
  assert.equal((await call('PUT', '/api/users/u-admin', op, { password: 'newpass1234' })).status, 403);
  const users = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'users.json'), 'utf8'));
  assert.equal(users.find(u => u.id === 'u-op').role, 'operator');
});

test('operator can change only own password, and cannot inject fields', async () => {
  await seed();
  const op = await login('op');
  assert.equal((await call('PUT', '/api/users/u-op', op, { password: 'newpass1234' })).status, 200);
  assert.equal((await call('PUT', '/api/users/u-op', op, { passwordHash: 'x', fullName: 'Z' })).status, 403);
  assert.equal((await call('GET', '/api/users/u-op', op)).status, 200);
  assert.equal((await call('GET', '/api/users/u-admin', op)).status, 403);
});

test('admin can list, create, update, and delete users', async () => {
  await seed();
  const admin = await login('admin');
  const list = await call('GET', '/api/users', admin);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).length, 3);
  const created = await call('POST', '/api/users', admin, { username: 'newop', password: 'abc1234567', fullName: 'New Op', role: 'operator' });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await call('PUT', `/api/users/${id}`, admin, { role: 'viewer' })).status, 200);
  assert.equal((await call('POST', '/api/users', admin, { username: 'bad', password: 'abc1234567', fullName: 'B', role: 'root' })).status, 400);
  assert.equal((await call('DELETE', `/api/users/${id}`, admin)).status, 200);
});

test('last admin cannot be deleted, demoted, or deactivated; admin cannot change own role', async () => {
  await seed();
  const admin = await login('admin');
  assert.equal((await call('DELETE', '/api/users/u-admin', admin)).status, 400);
  assert.equal((await call('PUT', '/api/users/u-admin', admin, { role: 'operator' })).status, 403);
  assert.equal((await call('PUT', '/api/users/u-admin', admin, { isActive: false })).status, 403);
  // A second admin can demote the first only while another admin remains.
  assert.equal((await call('PUT', '/api/users/u-op', admin, { role: 'admin' })).status, 200);
  const admin2 = await login('op');
  assert.equal((await call('PUT', '/api/users/u-admin', admin2, { role: 'operator' })).status, 200);
  // Now op is the last admin and cannot be removed by anyone.
  assert.equal((await call('DELETE', '/api/users/u-op', admin2)).status, 400);
});

test('demoted admin loses access immediately even with an old token', async () => {
  await seed();
  const admin = await login('admin');
  const users = JSON.parse(await fs.readFile(path.join(srv.dataDir, 'users.json'), 'utf8'));
  users.find(u => u.id === 'u-admin').role = 'operator';
  users.find(u => u.id === 'u-op').role = 'admin';
  await fs.writeFile(path.join(srv.dataDir, 'users.json'), JSON.stringify(users));
  assert.equal((await call('GET', '/api/users', admin)).status, 403);
});
