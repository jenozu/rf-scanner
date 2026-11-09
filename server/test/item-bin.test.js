import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAssignItemBin, validateAssignItemBin } from '../ops-logic.js';

const user = { username: 'tester' };

test('validate needs an item code and a bin code', () => {
  assert.ok(validateAssignItemBin({ binCode: '01-RACK' }));
  assert.ok(validateAssignItemBin({ itemCode: 'X1' }));
  assert.equal(validateAssignItemBin({ itemCode: 'X1', binCode: '01-RACK' }), null);
});

test('sets the bin on every master and active row for the item, and only that item', () => {
  const state = {
    master: [
      { ItemCode: '4157643-DTZ', BinCode: '' },
      { ItemCode: 'OTHER', BinCode: '01-A' },
    ],
    active: [{ ItemCode: '4157643-dtz', BinCode: '', ExpectedQty: 0 }],
  };
  const out = applyAssignItemBin(state, { itemCode: ' 4157643-DTZ ', binCode: ' 01-4a04 ' }, user);
  assert.equal(out.result.updated, 2);
  assert.equal(out.data.master[0].BinCode, '01-4A04');
  assert.equal(out.data.master[0].BinAssignedBy, 'tester');
  assert.equal(out.data.master[1].BinCode, '01-A');
  assert.equal(out.data.active[0].BinCode, '01-4A04');
  assert.equal(out.data.active[0].ExpectedQty, 0);
});

test('a list that is not stored yet is left alone', () => {
  const out = applyAssignItemBin({ master: null, active: [{ ItemCode: 'A', BinCode: '' }] }, { itemCode: 'A', binCode: '01-RACK' }, user);
  assert.equal(out.data.master, undefined);
  assert.equal(out.data.active[0].BinCode, '01-RACK');
});

test('an item in neither list reports updated: 0 and changes nothing', () => {
  const out = applyAssignItemBin({ master: [], active: [] }, { itemCode: 'NOPE', binCode: '01-RACK' }, user);
  assert.equal(out.result.updated, 0);
  assert.deepEqual(out.data.master, []);
});

test('system bins, placeholders and warehouse codes are refused', () => {
  const state = { master: [{ ItemCode: 'A', BinCode: '' }], active: [] };
  for (const code of ['01-SYSTEM-BIN-LOCATION', 'NO-BIN', '01']) {
    const out = applyAssignItemBin(state, { itemCode: 'A', binCode: code, warehouse: '01' }, user);
    assert.ok(out.result.error, code);
    assert.equal(out.data, undefined, code);
  }
});
