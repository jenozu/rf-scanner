import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareBinCodes, orderedRange, binRangesOverlap, findBinLockConflicts, BIN_LOCK_TTL_MS } from '../bin-range.js';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const fresh = (extra) => ({ sessionId: 's-other', sessionName: 'Other', username: 'bob', lockedAt: new Date(NOW - 60_000).toISOString(), ...extra });

test('numbered bins compare as numbers, not text', () => {
  assert.ok(compareBinCodes('01-A-2', '01-A-10') < 0);
  assert.ok(compareBinCodes('10', '2') > 0);
  assert.equal(compareBinCodes('01-a-02', '01-A-2'), 0);
});

test('a reversed range is put in order', () => {
  assert.deepEqual(orderedRange('01-A-10', '01-A-2'), ['01-A-2', '01-A-10']);
});

test('overlap uses numeric order: 2 to 10 overlaps 5 to 6, not 11 to 12', () => {
  assert.equal(binRangesOverlap('2', '10', '5', '6'), true);
  assert.equal(binRangesOverlap('2', '10', '11', '12'), false);
  assert.equal(binRangesOverlap('2', '10', '10', '12'), true, 'touching at the end counts as overlap');
  assert.equal(binRangesOverlap('10', '2', '5', '6'), true, 'reversed input still works');
});

test('ranges that only look overlapping as text do not conflict', () => {
  // As text, "10" sorts before "2", so the old check treated 3-to-4 as inside 10-to-2.
  assert.equal(binRangesOverlap('3', '4', '10', '2'), true);
  assert.equal(binRangesOverlap('11', '12', '2', '9'), false);
});

test('conflicts only come from other sessions, fresh locks, and overlapping ranges', () => {
  const locks = [
    fresh({ sessionId: 's-other', startBin: '2', endBin: '10' }),
    fresh({ sessionId: 's-mine', startBin: '2', endBin: '10' }),
    fresh({ sessionId: 's-far', startBin: '50', endBin: '60' }),
    fresh({ sessionId: 's-old', startBin: '2', endBin: '10', lockedAt: new Date(NOW - BIN_LOCK_TTL_MS - 1).toISOString() }),
  ];
  const found = findBinLockConflicts(locks, { startBin: '5', endBin: '6', sessionId: 's-mine', now: NOW });
  assert.deepEqual(found.map(l => l.sessionId), ['s-other']);
});

test('a lock with an unreadable time is not treated as a live conflict', () => {
  const found = findBinLockConflicts([fresh({ lockedAt: 'not a date', startBin: '1', endBin: '9' })],
    { startBin: '1', endBin: '9', sessionId: 'me', now: NOW });
  assert.equal(found.length, 0);
});
