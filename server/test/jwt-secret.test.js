import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveJwtSecret } from '../config.js';

const serverEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.js');
const GOOD = 'a'.repeat(48);
const OLD_DEFAULT = 'rf-scanner-secret-key-change-in-production';

// --- resolveJwtSecret ---------------------------------------------------

test('accepts a long random secret', () => {
  assert.equal(resolveJwtSecret({ JWT_SECRET: GOOD }), GOOD);
});

test('rejects a missing secret', () => {
  assert.throws(() => resolveJwtSecret({}), /JWT_SECRET is not set/);
});

test('rejects a blank or whitespace-only secret', () => {
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: '' }), /not set/);
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: '   ' }), /not set/);
});

test('rejects the old public default, in any letter case', () => {
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: OLD_DEFAULT }), /placeholder/);
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: OLD_DEFAULT.toUpperCase() }), /placeholder/);
});

test('rejects a secret shorter than 32 characters', () => {
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: 'x'.repeat(31) }), /too short/);
  assert.equal(resolveJwtSecret({ JWT_SECRET: 'x'.repeat(32) }), 'x'.repeat(32));
});

// --- real process startup -------------------------------------------------

function cleanEnv(extra) {
  const env = { ...process.env, ...extra };
  delete env.NODE_ENV; // production-style start: the test-only listen guard must be off
  for (const k of Object.keys(extra)) if (extra[k] === undefined) delete env[k];
  return env;
}

function run(extraEnv) {
  return spawn(process.execPath, [serverEntry], { env: cleanEnv(extraEnv) });
}

function collect(child) {
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  return () => out;
}

for (const [label, secret] of [
  ['no JWT_SECRET', undefined],
  ['the old public default', OLD_DEFAULT],
]) {
  test(`server exits non-zero at startup with ${label}`, async () => {
    const child = run({ JWT_SECRET: secret, PORT: '0' });
    const output = collect(child);
    const code = await new Promise((resolve) => child.on('exit', resolve));
    assert.equal(code, 1);
    assert.match(output(), /JWT_SECRET/);
  });
}

test('server starts and listens with a valid JWT_SECRET', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-api-start-'));
  const child = run({ JWT_SECRET: GOOD, PORT: '0', DATA_DIR: dataDir });
  const output = collect(child);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no start message. Output: ${output()}`)), 8000);
      child.stdout.on('data', () => {
        if (/running on port/.test(output())) { clearTimeout(timer); resolve(); }
      });
      child.on('exit', (c) => { clearTimeout(timer); reject(new Error(`exited early (${c}): ${output()}`)); });
    });
  } finally {
    child.kill();
    await new Promise((resolve) => child.on('exit', resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
