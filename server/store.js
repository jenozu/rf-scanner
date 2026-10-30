// JSON file storage with safe writes.
//
//  - Writes are atomic: data goes to a temp file, is flushed, then renamed over
//    the real file. A crash or a bad value never leaves a half-written file.
//  - Every file has a queue: read-modify-write cycles run one at a time, so two
//    requests cannot overwrite each other's changes.
//  - A "revision" (hash of the file contents) lets a client detect that the file
//    changed since it last read it. Writes that pass baseRevision are rejected
//    with ConflictError if it is stale. Writes without it are last-write-wins.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class ConflictError extends Error {
  constructor(currentRevision) {
    super('Data changed since it was read');
    this.name = 'ConflictError';
    this.code = 'REVISION_CONFLICT';
    this.currentRevision = currentRevision;
  }
}

const queues = new Map();

function enqueue(file, task) {
  const previous = queues.get(file) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(file, next);
  const cleanup = () => { if (queues.get(file) === next) queues.delete(file); };
  next.then(cleanup, cleanup);
  return next;
}

function revisionOf(raw) {
  return raw == null ? 'none' : crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

async function readRaw(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readWithRevision(file) {
  const raw = await readRaw(file);
  return { data: raw == null ? null : JSON.parse(raw), revision: revisionOf(raw) };
}

async function readJSON(file) {
  return (await readWithRevision(file)).data;
}

async function atomicWrite(file, data) {
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) throw new TypeError('Value cannot be saved as JSON');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const handle = await fs.open(tmp, 'w');
    try {
      await handle.writeFile(text, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  return revisionOf(text);
}

// Runs fn(tx) while holding the file's lock. tx.read() and tx.write() are safe
// to call inside; do not call writeJSON/update/locked for the same file inside fn.
function locked(file, fn) {
  return enqueue(file, async () => {
    const tx = {
      read: () => readWithRevision(file),
      async write(data, { baseRevision } = {}) {
        if (baseRevision !== undefined) {
          const current = revisionOf(await readRaw(file));
          if (current !== baseRevision) throw new ConflictError(current);
        }
        return atomicWrite(file, data);
      },
    };
    return fn(tx);
  });
}

// Read-modify-write under the lock. fn(current) returns { data, result }:
// data (if not undefined) is saved, result is returned to the caller.
function update(file, fn, options = {}) {
  return locked(file, async (tx) => {
    const { data: current, revision } = await tx.read();
    if (options.baseRevision !== undefined && options.baseRevision !== revision) {
      throw new ConflictError(revision);
    }
    const out = (await fn(current)) || {};
    if (out.data !== undefined) await tx.write(out.data);
    return out.result;
  });
}

function writeJSON(file, data, options = {}) {
  return locked(file, (tx) => tx.write(data, options));
}

export const store = { readJSON, readWithRevision, writeJSON, locked, update };
