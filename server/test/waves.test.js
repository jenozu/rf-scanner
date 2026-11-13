import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waveProgress, ordersInOpenWaves, hasPickedLines } from '../waves.js';
import { applyWaveCreate, validateWaveCreate, applyWaveDelete } from '../ops-logic.js';

const admin = { username: 'admin', role: 'admin' };
const operator = { username: 'picker', role: 'operator' };
const line = (over = {}) => ({ ItemCode: 'A', OrderedQty: 5, DeliveredQty: 0, RemainingQty: 5, BinCode: '01-0102', Warehouse: '01', ...over });
const so = (id, items, status = 'pending') => ({ id, soNumber: `SO-${id}`, status, items });
const byId = (sos) => Object.fromEntries(sos.map(s => [s.id, s]));

test('a wave with nothing picked is open; one partly picked is picking; all picked is completed', () => {
  const sos = [so('s1', [line(), line({ ItemCode: 'B' })]), so('s2', [line()])];
  assert.equal(waveProgress({ soIds: ['s1', 's2'] }, byId(sos)).status, 'open');
  sos[0].items[0] = line({ DeliveredQty: 2, RemainingQty: 3 });
  assert.equal(waveProgress({ soIds: ['s1', 's2'] }, byId(sos)).status, 'picking');
  sos[0].items = [line({ DeliveredQty: 5, RemainingQty: 0 }), line({ ItemCode: 'B', DeliveredQty: 5, RemainingQty: 0 })];
  sos[1].items = [line({ DeliveredQty: 5, RemainingQty: 0 })];
  const done = waveProgress({ soIds: ['s1', 's2'] }, byId(sos));
  assert.equal(done.status, 'completed');
  assert.equal(done.orderCount, 2);
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
  const sos = [so('s1', [line({ DeliveredQty: 1, RemainingQty: 4 })]), so('s2', [line()])];
  const waves = [{ id: 'w1', soIds: ['s1'] }, { id: 'w2', soIds: ['s2'] }];
  assert.equal(applyWaveDelete({ waves, sos }, { id: 'w1' }, admin).result.code, 'WAVE_HAS_PICKS');
  assert.equal(applyWaveDelete({ waves, sos }, { id: 'w2' }, operator).result.status, 403);
  const removed = applyWaveDelete({ waves, sos }, { id: 'w2' }, admin);
  assert.deepEqual(removed.data.waves.map(w => w.id), ['w1']);
});

test('a short-picked line counts as picked', () => {
  assert.equal(hasPickedLines(so('x', [line({ ShortPick: { reason: 'damaged' } })])), true);
  assert.equal(hasPickedLines(so('y', [line()])), false);
});
