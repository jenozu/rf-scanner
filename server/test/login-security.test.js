import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { startTestServer } from '../testing/helpers.js';

let srv;
const PW = 'correct-horse-1';

before(async () => {
  process.env.CORS_ORIGINS = 'https://allowed.example';
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(PW, 4);
  const mk = (id, username, role) => ({ id, username, passwordHash, fullName: username, role, isActive: true });
  await fs.writeFile(path.join(srv.dataDir, 'users.json'),
    JSON.stringify([mk('u-admin', 'admin', 'admin'), mk('u-a', 'victim', 'operator'), mk('u-b', 'other', 'operator')]));
});
after(async () => { await srv.close(); });

const login = (username, password) => fetch(`${srv.base}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
});

test('after 10 bad logins the account is locked with 429 + Retry-After, even for the right password', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await login('victim', 'wrong-' + i)).status, 401);
  const blocked = await login('victim', 'wrong-again');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await login('VICTIM', PW)).status, 429); // case-insensitive, right password still blocked
  assert.equal((await login('other', PW)).status, 200);   // other accounts unaffected
});

test('successful login clears the failure count', async () => {
  for (let i = 0; i < 5; i++) await login('other', 'nope-' + i);
  assert.equal((await login('other', PW)).status, 200);
  for (let i = 0; i < 6; i++) await login('other', 'nope-' + i);
  assert.equal((await login('other', PW)).status, 200); // 6 < 10 because the count reset
});

test('passwords shorter than 10 characters are rejected on create and change', async () => {
  const token = (await (await login('admin', PW)).json()).token;
  const call = (method, url, body) => fetch(`${srv.base}${url}`, {
    method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  assert.equal((await call('POST', '/api/users', { username: 'n1', password: '123456789', fullName: 'N' })).status, 400);
  assert.equal((await call('POST', '/api/users', { username: 'n1', password: '1234567890', fullName: 'N' })).status, 201);
  assert.equal((await call('PUT', '/api/users/u-b', { password: 'short' })).status, 400);
  assert.equal((await call('PUT', '/api/users/u-b', { password: 'long-enough-1' })).status, 200);
});

test('CORS: only listed origins get an allow header', async () => {
  const get = (origin) => fetch(`${srv.base}/api/health`, { headers: { origin } });
  assert.equal((await get('https://evil.example')).headers.get('access-control-allow-origin'), null);
  assert.equal((await get('https://allowed.example')).headers.get('access-control-allow-origin'), 'https://allowed.example');
  const plain = await fetch(`${srv.base}/api/health`);
  assert.equal(plain.status, 200); // same-origin / non-browser requests unaffected
});
