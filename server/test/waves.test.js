import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveProgress, ordersInOpenWaves, waveHasPicks, wavePickKey } from '../waves.js';
import { applyWaveCreate, validateWaveCreate, applyWaveDelete, applyPickSo } from '../ops-logic.js';

const admin = { username: 'admin', role: 'admin' };
const operator = { username: 'picker', role: 'operator' };
const line = (over = {}) => ({ ItemCode: 'A', OrderedQty: 5, DeliveredQty: 0, RemainingQty: 5, BinCode: '01-0102', Warehouse: '01', ...over });
const so = (id, items, status = 'pending') => ({ id, soNumber: `SO-${id}`, status, items });
const byId = (sos) => Object.fromEntries(sos.map(s => [s.id, s]));

test('a wave is open until a line is picked in it, picking after that, completed when nothing is open', () => {
  const sos = [so('s1', [line(), line({ ItemCode: 'B' })]), so('s2', [line()])];
  const wave = { soIds: ['s1', 's2'], picked: [] };
  assert.equal(waveProgress(wave, byId(sos)).status, 'open');
  wave.picked = ['s1|1:0'];
  assert.equal(waveProgress(wave, byId(sos)).status, 'picking');
  assert.equal(waveProgress(wave, byId(sos)).pickedLines, 1);
  sos[0].items = [line({ DeliveredQty: 5, RemainingQty: 0 }), line({ ItemCode: 'B', DeliveredQty: 5, RemainingQty: 0 })];
  sos[1].items = [line({ DeliveredQty: 5, RemainingQty: 0 })];
  const done = waveProgress(wave, byId(sos));
  assert.equal(done.status, 'completed');
  assert.equal(done.orderCount, 2);
});

test('lines delivered before the wave was made are not wave progress', () => {
  // SO s1 had 4 of 10 delivered last week; the wave has picked nothing yet.
  const sos = [so('s1', [line({ OrderedQty: 10, DeliveredQty: 4, RemainingQty: 6 })], 'picking')];
  const progress = waveProgress({ soIds: ['s1'], picked: [] }, byId(sos));
  assert.equal(progress.status, 'open');
  assert.equal(progress.pickedLines, 0);
});

test('a SAP-closed line does not hold a wave open', () => {
  const sos = [so('s1', [line({ RemainingQty: 0, DeliveredQty: 5 }), line({ ItemCode: 'Z', RemainingQty: 4, SapClosed: true })])];
  assert.equal(waveProgress({ soIds: ['s1'] }, byId(sos)).status, 'completed');
});

test('completed waves release their orders; open waves keep them', () => {
  const sos = [so('s1', [line({ RemainingQty: 0, DeliveredQty: 5 })]), so('s2', [line()])];
  const waves = [{ id: 'w1', soIds: ['s1'] }, { id: 'w2', soIds: ['s2'] }];
  const taken = ordersInOpenWaves(waves, byId(sos));
  assert.equal(taken.has('s1'), false, 'completed wave no longer holds s1');
  assert.equal(taken.has('s2'), true);
});

test('creating a wave: admin only, pickable orders only, no order in two open waves', () => {
  const sos = [so('s1', [line()]), so('s2', [line()]), so('s3', [line()], 'shipped'), so('s4', [line({ RemainingQty: 0, DeliveredQty: 5 })])];
  const state = { waves: [], sos };
  assert.equal(applyWaveCreate(state, { soIds: ['s1'] }, operator).result.status, 403);
  assert.equal(applyWaveCreate(state, { soIds: ['s3'] }, admin).result.code, 'SO_NOT_PICKABLE');
  assert.equal(applyWaveCreate(state, { soIds: ['s4'] }, admin).result.code, 'SO_NOTHING_OPEN');
  assert.equal(applyWaveCreate(state, { soIds: ['nope'] }, admin).result.status, 404);

  const made = applyWaveCreate(state, { soIds: ['s1', 's2'] }, admin);
  assert.equal(made.result.ok, true);
  assert.equal(made.result.wave.waveNumber, 'W-001');
  assert.equal(made.result.wave.createdBy, 'admin');

  const clash = applyWaveCreate({ waves: made.data.waves, sos }, { soIds: ['s2'] }, admin);
  assert.equal(clash.result.code, 'SO_IN_WAVE');
});

test('wave numbers continue from the highest existing number', () => {
  const sos = [so('s1', [line()])];
  const made = applyWaveCreate({ waves: [{ id: 'a', waveNumber: 'W-007', soIds: [] }], sos }, { soIds: ['s1'] }, admin);
  assert.equal(made.result.wave.waveNumber, 'W-008');
});

test('the wave request validates its shape', () => {
  assert.ok(validateWaveCreate({ soIds: [] }));
  assert.ok(validateWaveCreate({ soIds: ['a', 'a'] }));
  assert.equal(validateWaveCreate({ soIds: ['a', 'b'] }), null);
});

test('a wave with picks cannot be deleted; an untouched one can, by admin only', () => {
  const sos = [so('s1', [line()]), so('s2', [line()])];
  const waves = [{ id: 'w1', soIds: ['s1'], picked: ['s1|1:0'] }, { id: 'w2', soIds: ['s2'], picked: [] }];
  assert.equal(applyWaveDelete({ waves, sos }, { id: 'w1' }, admin).result.code, 'WAVE_HAS_PICKS');
  assert.equal(applyWaveDelete({ waves, sos }, { id: 'w2' }, operator).result.status, 403);
  const removed = applyWaveDelete({ waves, sos }, { id: 'w2' }, admin);
  assert.deepEqual(removed.data.waves.map(w => w.id), ['w1']);
});

test('a wave of part-delivered orders can still be deleted while nothing was picked in it', () => {
  const sos = [so('s1', [line({ OrderedQty: 10, DeliveredQty: 4, RemainingQty: 6, ShortPick: { reason: 'old' } })], 'picking')];
  const made = applyWaveCreate({ waves: [], sos }, { soIds: ['s1'] }, admin);
  assert.deepEqual(made.result.wave.picked, []);
  assert.equal(waveHasPicks(made.result.wave), false);
  const removed = applyWaveDelete({ waves: made.data.waves, sos }, { id: made.result.wave.id }, admin);
  assert.equal(removed.result.ok, true);
});

const pickLine = () => ({ ...line({ LineKey: '1:0', LineNumber: 0 }) });
const bins = () => [{ BinCode: '01-0102', Items: [{ ItemCode: 'A', Quantity: 50 }] }];

test('a pick on an order in an open wave is recorded on that wave and in the pick log', () => {
  const sos = [so('s1', [pickLine()]), so('s2', [{ ...pickLine(), LineKey: '2:0' }])];
  const waves = [{ id: 'w1', soIds: ['s1'], picked: [] }];
  const out = applyPickSo({ sos, bins: bins(), txns: [], waves },
    { soId: 's1', lineKey: '1:0', qty: 2, txnId: 't1', scannedCode: 'A' }, operator);
  assert.equal(out.result.ok, true);
  assert.deepEqual(out.data.waves[0].picked, ['s1|1:0']);
  assert.equal(out.result.txn.waveId, 'w1');
  assert.equal(out.result.txn.soId, 's1');

  // The same line picked again is listed once.
  const again = applyPickSo({ sos: out.data.sos, bins: out.data.bins, txns: out.data.txns, waves: out.data.waves },
    { soId: 's1', lineKey: '1:0', qty: 1, txnId: 't2', scannedCode: 'A' }, operator);
  assert.deepEqual(again.data.waves[0].picked, ['s1|1:0']);
});

test('a pick on an order in no wave leaves the waves alone', () => {
  const sos = [so('s1', [pickLine()]), so('s2', [{ ...pickLine(), LineKey: '2:0' }])];
  const waves = [{ id: 'w1', soIds: ['s1'], picked: [] }];
  const out = applyPickSo({ sos, bins: bins(), txns: [], waves },
    { soId: 's2', lineKey: '2:0', qty: 1, txnId: 't1', scannedCode: 'A' }, operator);
  assert.equal(out.result.ok, true);
  assert.equal(out.data.waves, undefined, 'waves file not rewritten');
  assert.equal(out.result.txn.waveId, undefined);
});

test('the pick that finishes the wave is still recorded on it', () => {
  const sos = [so('s1', [pickLine()])];
  const waves = [{ id: 'w1', soIds: ['s1'], picked: [] }];
  const out = applyPickSo({ sos, bins: bins(), txns: [], waves },
    { soId: 's1', lineKey: '1:0', qty: 5, txnId: 't1', scannedCode: 'A' }, operator);
  assert.deepEqual(out.data.waves[0].picked, ['s1|1:0']);
  assert.equal(waveProgress(out.data.waves[0], byId(out.data.sos)).status, 'completed');
});

test('a short pick counts as wave work', () => {
  const sos = [so('s1', [pickLine()])];
  const waves = [{ id: 'w1', soIds: ['s1'], picked: [] }];
  const out = applyPickSo({ sos, bins: bins(), txns: [], waves },
    { soId: 's1', lineKey: '1:0', qty: 0, txnId: 't1', short: { reason: 'not found' } }, operator);
  assert.equal(out.result.ok, true);
  assert.deepEqual(out.data.waves[0].picked, ['s1|1:0']);
});

test('pick keys fall back to the SAP line number for lines without a LineKey', () => {
  assert.equal(wavePickKey('s1', { LineKey: '9:2' }), 's1|9:2');
  assert.equal(wavePickKey('s1', { LineNumber: 3 }), 's1|#3');
});
