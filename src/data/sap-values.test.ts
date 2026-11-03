import { describe, it, expect } from 'vitest';
import { parseQty, parseSapDate } from './sap-values';

describe('parseQty', () => {
  it('reads numbers and plain text', () => {
    expect(parseQty(12)).toBe(12);
    expect(parseQty('12.5')).toBe(12.5);
    expect(parseQty(' -3 ')).toBe(-3);
  });

  it('accepts thousands separators with a comma or a space', () => {
    expect(parseQty('1,000')).toBe(1000);
    expect(parseQty('1 000')).toBe(1000);
    expect(parseQty('1,234,567.5')).toBe(1234567.5);
  });

  it('rejects values it cannot read instead of returning 0', () => {
    expect(parseQty('1.000,50')).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseQty('')).toBeNull();
    expect(parseQty(undefined)).toBeNull();
    expect(parseQty(NaN)).toBeNull();
  });
});

describe('parseSapDate', () => {
  it('turns Excel date serials into dates', () => {
    expect(parseSapDate(46327)).toBe('2026-11-01');
    expect(parseSapDate('46327')).toBe('2026-11-01');
    expect(parseSapDate(46327.75)).toBe('2026-11-01');
  });

  it('reads yyyymmdd and ISO forms', () => {
    expect(parseSapDate('20261103')).toBe('2026-11-03');
    expect(parseSapDate('2026-11-15')).toBe('2026-11-15');
    expect(parseSapDate('2026-11-15 00:00:00')).toBe('2026-11-15');
    expect(parseSapDate('2026/11/15')).toBe('2026-11-15');
  });

  it('reads a local Date by its calendar date', () => {
    expect(parseSapDate(new Date(2026, 10, 3))).toBe('2026-11-03');
  });

  it('returns null for impossible or ambiguous dates instead of a fallback', () => {
    expect(parseSapDate('2026-02-30')).toBeNull();
    expect(parseSapDate('03/11/2026')).toBeNull();
    expect(parseSapDate('not a date')).toBeNull();
    expect(parseSapDate('')).toBeNull();
    expect(parseSapDate(10)).toBeNull();
    expect(parseSapDate(new Date('garbage'))).toBeNull();
  });
});
