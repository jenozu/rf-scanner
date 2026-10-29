import { describe, it, expect } from 'vitest';
import { mergeCSVData } from './csv-utils';
import type { Item } from '../types';

const item = (over: Partial<Item>): Item => ({
  BinCode: '01-A-01',
  ItemCode: '100001',
  Description: 'Sample item',
  ExpectedQty: 5,
  ...over,
});

describe('mergeCSVData', () => {
  it('keeps counted quantity for an item that exists in the same bin', () => {
    const old = [item({ CountedQty: 4, Variance: -1 })];
    const next = [item({ ExpectedQty: 6 })];
    const [merged] = mergeCSVData(old, next);
    expect(merged.ExpectedQty).toBe(6);
    expect(merged.CountedQty).toBe(4);
    expect(merged.Variance).toBe(-1);
  });

  it('does not carry a count across to the same item in a different bin', () => {
    const old = [item({ BinCode: '01-A-01', CountedQty: 4 })];
    const next = [item({ BinCode: '01-A-02' })];
    const [merged] = mergeCSVData(old, next);
    expect(merged.CountedQty).toBeUndefined();
  });
});
