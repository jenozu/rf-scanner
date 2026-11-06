import { describe, it, expect } from 'vitest';
import { summarizeImport } from './import-summary';
import type { ImportReport } from './sap-import';
import type { ImportResult } from '../../server/order-import.js';

const report = (over: Partial<ImportReport> = {}): ImportReport => ({
  kind: 'so', fileName: 'so.xlsx', columns: { found: [], mapped: {} }, rowsRead: 10, ordersFound: 3, linesAccepted: 10,
  skipped: [], warnings: [], ...over,
});
const server = (over: Partial<ImportResult> = {}): ImportResult => ({
  ok: true, kind: 'so', added: 3, updated: 0, unchanged: 0,
  lines: { added: 0, updated: 0, unchanged: 0, closed: 0, reopened: 0 }, conflicts: [], notes: [], orders: [], ...over,
});

describe('summarizeImport', () => {
  it('reports a clean first import as success', () => {
    const s = summarizeImport(report(), server());
    expect(s.tone).toBe('success');
    expect(s.headline).toBe('Read 3 sales orders (10 lines) from so.xlsx: 3 new.');
  });

  it('says a repeat import changed nothing', () => {
    const s = summarizeImport(report(), server({ added: 0, unchanged: 3 }));
    expect(s.headline).toContain('3 already up to date');
    expect(s.tone).toBe('success');
  });

  it('explains that received/picked quantities were kept when orders were updated', () => {
    const s = summarizeImport(report(), server({ added: 0, updated: 2, lines: { added: 1, updated: 3, unchanged: 0, closed: 1, reopened: 0 } }));
    expect(s.details.join(' ')).toContain('Received/picked quantities were kept');
    expect(s.details.join(' ')).toContain('1 line no longer in SAP');
  });

  it('asks for attention when rows were skipped or an order conflicts', () => {
    const skipped = [{ row: 5, reason: 'missing-doc-number' as const, message: 'No order number on this row' }];
    expect(summarizeImport(report({ skipped }), server()).tone).toBe('attention');
    const s = summarizeImport(report(), server({ conflicts: [{ code: 'ITEM_CHANGED', docNum: '1', message: 'Order 1 line 0 changed' }] }));
    expect(s.tone).toBe('attention');
    expect(s.details.join(' ')).toContain('Needs a person: Order 1 line 0 changed');
  });

  it('does not warn about lines SAP already finished', () => {
    const s = summarizeImport(report({ warnings: [{ code: 'line-already-complete', count: 4, message: 'x', rows: [] }] }), server());
    expect(s.details).toEqual([]);
  });
});
