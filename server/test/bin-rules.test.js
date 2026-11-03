import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBin, isRealBin } from '../ops-logic.js';

test('real bins are accepted', () => {
  for (const code of ['01-RACK', 'B-02-01', '01-A-01', 'DOCK', 'D-01-01', ' 01-rack ']) {
    assert.equal(classifyBin(code).real, true, code);
  }
});

test('blank values are not a bin', () => {
  for (const code of [undefined, null, '', '   ']) {
    assert.deepEqual([classifyBin(code).kind, classifyBin(code).real], ['blank', false]);
  }
});

test("SAP's system bin is not a real bin, whatever the warehouse prefix or spelling", () => {
  for (const code of ['01-SYSTEM-BIN-LOCATION', '02-SYSTEM-BIN-LOCATION', 'SYSTEMBIN', 'system bin', 'SYSTEM_BIN', '01-systembin-location']) {
    assert.equal(classifyBin(code).kind, 'system', code);
    assert.equal(isRealBin(code), false, code);
  }
});

test('placeholders are not a bin', () => {
  for (const code of ['NO-BIN', 'no bin', 'NOBIN', 'N/A', 'NA', 'none', 'NULL', 'unassigned', 'TBD', '?', '--']) {
    assert.equal(classifyBin(code).kind, 'placeholder', code);
  }
});

test('a bare warehouse code is not a bin (the old importer turned WhsCode into a bin)', () => {
  for (const code of ['01', '1', '05']) assert.equal(classifyBin(code).kind, 'warehouse-only', code);
  assert.equal(classifyBin('MAIN', 'main').kind, 'warehouse-only'); // equals the line's own warehouse code
  assert.equal(classifyBin('MAIN', 'WH2').real, true);
});

test('the reason says what is wrong, in plain words', () => {
  assert.match(classifyBin('01-SYSTEM-BIN-LOCATION').reason, /system bin/i);
  assert.match(classifyBin('').reason, /No bin/);
  assert.match(classifyBin('01').reason, /warehouse code/);
});

import { normalizeWarehouse, isCustomerWarehouse } from '../ops-logic.js';

test('warehouse 05 is recognised however SAP or Excel writes it', () => {
  for (const w of ['05', '5', 5, ' 05 ']) assert.equal(isCustomerWarehouse(w), true, String(w));
  for (const w of ['01', '1', '', null, undefined, '50', 'MAIN']) assert.equal(isCustomerWarehouse(w), false, String(w));
  assert.equal(normalizeWarehouse(5), '05');
  assert.equal(normalizeWarehouse('main'), 'MAIN');
});

test('warehouse 05 lines use the shared 01 bin codes as real bins', () => {
  assert.equal(classifyBin('01-RACK-A', '05').real, true);
  assert.equal(classifyBin('05', '05').kind, 'warehouse-only');
  assert.equal(classifyBin('5', '05').kind, 'warehouse-only');
  assert.equal(classifyBin('05-SYSTEM-BIN-LOCATION', '05').kind, 'system');
  assert.equal(classifyBin('01-SYSTEM-BIN-LOCATION', '05').kind, 'system');
});
