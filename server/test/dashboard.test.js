import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboard } from '../dashboard.js';

const empty = { purchaseOrders: [], salesOrders: [], orders: [], waves: [], cycleCounts: [], bins: [], receivingTxns: [], countTxns: [], countVariances: [] };

test('order and line counts follow the statuses the server writes', () => {
  const d = computeDashboard({
    ...empty,
    purchaseOrders: [{ status: 'pending' }, { status: 'receiving' }, { status: 'receiving' }, { status: 'completed' }],
    salesOrders: [{ status: 'pending' }, { status: 'picking' }, { status: 'picked' }, { status: 'shipped', shippedDate: '2026-11-12' }],
    bins: [{}, {}, {}],
  });
  assert.equal(d.stats.pendingPOs, 1);
  assert.equal(d.stats.receivingPOs, 2);
  assert.equal(d.stats.pendingOrders, 2);
  assert.equal(d.stats.readyToShip, 1);
  assert.equal(d.stats.shipped, 1);
  assert.equal(d.stats.totalBins, 3);
});

test('pending count approvals are counted separately from the old count status', () => {
  const d = computeDashboard({ ...empty, countVariances: [{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }] });
  assert.equal(d.stats.pendingApprovals, 2);
});

test('accuracy is the share of completed counts with no variance', () => {
  const d = computeDashboard({ ...empty, cycleCounts: [
    { Status: 'completed', Variance: 0 }, { Status: 'completed', Variance: -1 },
    { Status: 'completed', Variance: 0 }, { Status: 'pending', Variance: 0 },
  ] });
  assert.equal(d.stats.completedCounts, 3);
  assert.equal(d.stats.accuracy, 67);
});

test('the timeline is newest first, mixes activity types, and keeps six', () => {
  const d = computeDashboard({
    ...empty,
    receivingTxns: [{ id: 'r1', timestamp: '2026-11-13T09:00:00Z', poNumber: 'P1', qty: 1, itemCode: 'A', binCode: '01-1' }],
    countTxns: [
      { id: 'c1', timestamp: '2026-11-13T11:00:00Z', variance: -2, binCode: '01-2', itemCode: 'B' },
      { id: 'c2', timestamp: '2026-11-13T08:00:00Z', variance: 0, binCode: '01-3', itemCode: 'C' },
    ],
    salesOrders: [{ id: 's1', status: 'shipped', shippedDate: '2026-11-13T10:00:00Z', soNumber: 'S1', customer: 'X' }],
  });
  assert.deepEqual(d.timeline.map(e => e.id), ['c1', 'ship-s1', 'r1', 'c2']);
  assert.equal(d.timeline[0].tone, 'warn');
  assert.equal(d.timeline[1].tone, 'good');
});

test('the timeline keeps at most six entries', () => {
  const countTxns = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, timestamp: `2026-11-13T0${i % 9}:00:00Z`, variance: 0, binCode: 'b', itemCode: 'i' }));
  assert.equal(computeDashboard({ ...empty, countTxns }).timeline.length, 6);
});

test('missing files count as empty, not as errors', () => {
  const d = computeDashboard({});
  assert.equal(d.stats.totalBins, 0);
  assert.deepEqual(d.timeline, []);
});
