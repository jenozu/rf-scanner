import { describe, it, expect } from 'vitest';
import { mergeCSVData, extractBinAndWarehouse } from './csv-utils';
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

describe('extractBinAndWarehouse', () => {
  it('reads warehouse 05 (even as the number 5) and keeps the shared 01 bin', () => {
    expect(extractBinAndWarehouse({ WhsCode: 5, BinCode: '01-RACK-A' })).toEqual({ binCode: '01-RACK-A', warehouse: '05' });
    expect(extractBinAndWarehouse({ WhsCode: '05', 'Default Bin Location': '01-RACK-A' })).toEqual({ binCode: '01-RACK-A', warehouse: '05' });
  });

  it('keeps the warehouse apart: a WhsCode column is never turned into a bin', () => {
    expect(extractBinAndWarehouse({ ItemCode: 'A', WhsCode: '01' })).toEqual({ binCode: undefined, warehouse: '01' });
  });

  it('reads the bin from the usual bin columns, whatever the spelling', () => {
    expect(extractBinAndWarehouse({ BinCode: '01-RACK' }).binCode).toBe('01-RACK');
    expect(extractBinAndWarehouse({ bin_code: '01-RACK' }).binCode).toBe('01-RACK');
    expect(extractBinAndWarehouse({ 'Bin Location': '01-RACK' }).binCode).toBe('01-RACK');
    expect(extractBinAndWarehouse({ Bin: ' 01-RACK ' }).binCode).toBe('01-RACK');
  });

  it("uses the line's own bin first, then the default bin, then the first bin", () => {
    expect(extractBinAndWarehouse({ BinCode: '01-A', 'Default Bin Location': '01-B', 'First Bin Location': '01-C' }).binCode).toBe('01-A');
    expect(extractBinAndWarehouse({ 'Default Bin Location': '01-B', 'First Bin Location': '01-C' }).binCode).toBe('01-B');
    expect(extractBinAndWarehouse({ 'First Bin Location': '01-C' }).binCode).toBe('01-C');
  });

  it('skips a system or placeholder bin when a real one is available', () => {
    expect(extractBinAndWarehouse({ BinCode: '01-SYSTEM-BIN-LOCATION', 'Default Bin Location': '01-RACK' }).binCode).toBe('01-RACK');
    expect(extractBinAndWarehouse({ BinCode: 'NO-BIN', 'First Bin Location': '01-RACK' }).binCode).toBe('01-RACK');
    expect(extractBinAndWarehouse({ BinCode: '', 'Default Bin Location': '01-RACK' }).binCode).toBe('01-RACK');
  });

  it('keeps what SAP had when nothing real exists, so the screen can say so', () => {
    expect(extractBinAndWarehouse({ BinCode: '01-SYSTEM-BIN-LOCATION' }).binCode).toBe('01-SYSTEM-BIN-LOCATION');
    expect(extractBinAndWarehouse({ BinCode: '01', Warehouse: '01' }).binCode).toBe('01');
  });

  it('returns nothing for rows with no bin or warehouse columns', () => {
    expect(extractBinAndWarehouse({ ItemCode: 'A', OrderedQty: '5' })).toEqual({ binCode: undefined, warehouse: undefined });
  });

  it("reads SAP's own 'FisrtBin' column (the first bin on a document line)", () => {
    expect(extractBinAndWarehouse({ FisrtBin: '01-RACK', WhsCode: '01' })).toEqual({ binCode: '01-RACK', warehouse: '01' });
    expect(extractBinAndWarehouse({ FisrtBin: '01-SYSTEM-BIN-LOCATION', 'Default Bin Location': '01-RACK' }).binCode).toBe('01-RACK');
  });

  it('reads the warehouse from the usual columns', () => {
    expect(extractBinAndWarehouse({ Warehouse: '02' }).warehouse).toBe('02');
    expect(extractBinAndWarehouse({ 'Whse Code': '03' }).warehouse).toBe('03');
  });
});
