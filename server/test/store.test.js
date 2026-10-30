import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { store, ConflictError } from '../store.js';

async function tmpFile(name = 'data.json') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-store-'));
  return path.join(dir, name);
}

test('write then read round-trips and leaves no temp files', async () => {
  const file = await tmpFile();
  await store.writeJSON(file, [{ a: 1 }]);
  assert.deepEqual(await store.readJSON(file), [{ a: 1 }]);
  const names = await fs.readdir(path.dirname(file));
  assert.deepEqual(names, ['data.json']);
});

test('a failed write leaves the old file intact and no temp file', async () => {
  const file = await tmpFile();
  await store.writeJSON(file, { ok: true });
  const circular = {}; circular.self = circular;
  await assert.rejects(store.writeJSON(file, circular));
  await assert.rejects(store.writeJSON(file, undefined));
  assert.deepEqual(await store.readJSON(file), { ok: true });
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['data.json']);
});

test('a failed rename cleans up its temp file and keeps the old data', async () => {
  const file = await tmpFile();
  await store.writeJSON(file, { v: 1 });
  // Make the target a directory so rename cannot replace it.
  const blocked = await tmpFile('blocked.json');
  await fs.mkdir(blocked);
  await assert.rejects(store.writeJSON(blocked, { v: 2 }));
  const names = await fs.readdir(path.dirname(blocked));
  assert.deepEqual(names, ['blocked.json']);
  assert.deepEqual(await store.readJSON(file), { v: 1 });
});

test('50 parallel increments through update() all land', async () => {
  const file = await tmpFile();
  await store.writeJSON(file, { n: 0 });
  await Promise.all(Array.from({ length: 50 }, () =>
    store.update(file, (cur) => ({ data: { n: cur.n + 1 } }))));
  assert.equal((await store.readJSON(file)).n, 50);
});

test('without the queue naive read-modify-write loses updates (why the queue exists)', async () => {
  const file = await tmpFile();
  await store.writeJSON(file, { n: 0 });
  await Promise.all(Array.from({ length: 20 }, async () => {
    const cur = await store.readJSON(file);
    await store.writeJSON(file, { n: cur.n + 1 });
  }));
  assert.ok((await store.readJSON(file)).n < 20);
});

test('update() can skip the write and return a result', async () => {
  const file = await tmpFile();
  const result = await store.update(file, (cur) => ({ result: cur === null ? 'missing' : 'present' }));
  assert.equal(result, 'missing');
  await assert.rejects(fs.access(file));
});

test('a failing task does not block the queue', async () => {
  const file = await tmpFile();
  await assert.rejects(store.update(file, () => { throw new Error('boom'); }), /boom/);
  await store.update(file, () => ({ data: [1] }));
  assert.deepEqual(await store.readJSON(file), [1]);
});

test('revision changes with content; stale baseRevision gives ConflictError', async () => {
  const file = await tmpFile();
  assert.equal((await store.readWithRevision(file)).revision, 'none');
  await store.writeJSON(file, [1], { baseRevision: 'none' });
  const { revision } = await store.readWithRevision(file);
  assert.notEqual(revision, 'none');
  await store.writeJSON(file, [1, 2], { baseRevision: revision });
  await assert.rejects(store.writeJSON(file, [9], { baseRevision: revision }), (e) => {
    assert.ok(e instanceof ConflictError);
    assert.notEqual(e.currentRevision, revision);
    return true;
  });
  assert.deepEqual(await store.readJSON(file), [1, 2]);
  await assert.rejects(store.update(file, () => ({ data: [] }), { baseRevision: revision }), ConflictError);
});

test('queues are per file: a slow task on one file does not delay another', async () => {
  const a = await tmpFile('a.json');
  const b = await tmpFile('b.json');
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = store.locked(a, async () => { await gate; return 'a'; });
  await store.writeJSON(b, [1]);
  assert.deepEqual(await store.readJSON(b), [1]);
  release();
  assert.equal(await slow, 'a');
});

test('lockedMany: opposite-order callers on the same two files do not deadlock and do not interleave', async () => {
  const a = await tmpFile('a.json');
  const b = await tmpFile('b.json');
  await store.writeJSON(a, { n: 0 });
  await store.writeJSON(b, { n: 0 });
  const bump = (files) => store.lockedMany(files, async (txs) => {
    for (const f of files) {
      const { data } = await txs[f].read();
      await new Promise((r) => setTimeout(r, 1));
      await txs[f].write({ n: data.n + 1 });
    }
  });
  await Promise.all(Array.from({ length: 20 }, (_, i) => bump(i % 2 ? [a, b] : [b, a])));
  assert.equal((await store.readJSON(a)).n, 20);
  assert.equal((await store.readJSON(b)).n, 20);
});
