// Types for the shared operations logic (see ops-logic.js).
export interface OpFailure { error: string; status: number; [extra: string]: unknown }
export interface OpOutcome<R = any> { data?: any; result: R | OpFailure }
export const APPEND_KEYS: Record<string, { cap: number | null }>;
export const RECORD_KEYS: string[];
export function validateAppend(body: any): OpFailure | null;
export function applyAppend(current: any[] | null, body: any): OpOutcome;
export function validateBinAdjust(body: any): OpFailure | null;
export function applyBinAdjust(current: any[] | null, body: any): OpOutcome;
export function validatePoReceive(body: any): OpFailure | null;
export function applyPoReceive(current: any[] | null, body: any): OpOutcome;
export function validateSoPick(body: any): OpFailure | null;
export function applySoPick(current: any[] | null, body: any, user?: { username?: string } | null): OpOutcome;
export function validateShip(body: any): OpFailure | null;
export function applyShip(current: any[] | null, body: any): OpOutcome;
export function blockOrderWrites(key: string, writesRecords?: boolean): OpFailure | null;
export function validateRecordKey(key: string): OpFailure | null;
export function validateRecordUpsert(id: string, body: any): OpFailure | null;
export function applyRecordUpsert(current: any[] | null, record: any): OpOutcome;
export function applyRecordDelete(current: any[] | null, id: string): OpOutcome;
export function validateUpsertMany(body: any): OpFailure | null;
export function applyUpsertMany(current: any[] | null, body: any): OpOutcome;
export function validateReceive(body: any): OpFailure | null;
export function applyReceive(state: { pos: any[] | null; bins: any[] | null; txns: any[] | null }, body: any, user?: { username?: string } | null): OpOutcome;
export function validatePickSo(body: any): OpFailure | null;
export function applyPickSo(state: { sos: any[] | null; bins: any[] | null; txns: any[] | null }, body: any, user?: { username?: string } | null): OpOutcome;
export function validateRecordChanges(body: any): OpFailure | null;
export function applyRecordChanges(current: any[] | null, body: any): OpOutcome;
export function validateBinsSet(body: any): OpFailure | null;
export function applyBinsSet(current: any[] | null, body: any): OpOutcome;
export function validateCountSubmit(body: any): OpFailure | null;
export function applyCountSubmit(state: { bins?: any[] | null; variances?: any[] | null }, body: any, user?: { username?: string } | null): OpOutcome;
export function validateVarianceDecision(body: any): OpFailure | null;
export function applyVarianceDecision(state: { bins?: any[] | null; variances?: any[] | null }, body: any, user?: { username?: string; role?: string } | null): OpOutcome;
export interface BinClass { kind: 'real' | 'blank' | 'system' | 'placeholder' | 'warehouse-only'; real: boolean; reason: string }
export function classifyBin(code: string | null | undefined, warehouse?: string | null): BinClass;
export function isRealBin(code: string | null | undefined, warehouse?: string | null): boolean;
export function validateAssignBin(body: any): OpFailure | null;
export function applyAssignBin(state: { sos: any[] | null; bins: any[] | null }, body: any, user?: { username?: string } | null): OpOutcome;
export function validateAssignItemBin(body: any): OpFailure | null;
export function applyAssignItemBin(state: { master: any[] | null; active: any[] | null }, body: any, user?: { username?: string } | null): OpOutcome;
export const WAREHOUSE_NAMES: Record<string, string>;
export const CUSTOMER_WAREHOUSE: string;
export function normalizeWarehouse(value: unknown): string;
export function isCustomerWarehouse(warehouse: unknown): boolean;
