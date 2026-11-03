import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';

const dir = join(__dirname);

describe('SAP-style fixtures', () => {
  it('workbook has the three sheets from the column contract', () => {
    const wb = XLSX.read(readFileSync(join(dir, 'sap-sample.xlsx')), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Master Inventory', 'Purchase Orders', 'Sales Orders']);
  });

  it('CSV fixtures have the expected header and row count', () => {
    const po = readFileSync(join(dir, 'po-sample.csv'), 'utf8').trim().split('\n');
    const so = readFileSync(join(dir, 'so-sample.csv'), 'utf8').trim().split('\n');
    expect(po[0].split(',')).toContain('LineNumber');
    expect(po).toHaveLength(8); // header + 7 rows
    expect(so[0].split(',')).toContain('OpenQty');
    expect(so).toHaveLength(4); // header + 3 rows
  });
});
