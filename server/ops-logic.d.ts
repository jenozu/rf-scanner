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
export function applySoPick(current: any[] | null, body: any): OpOutcome;
export function validateRecordKey(key: string): OpFailure | null;
export function validateRecordUpsert(id: string, body: any): OpFailure | null;
export function applyRecordUpsert(current: any[] | null, record: any): OpOutcome;
export function applyRecordDelete(current: any[] | null, id: string): OpOutcome;
export function validateUpsertMany(body: any): OpFailure | null;
export function applyUpsertMany(current: any[] | null, body: any): OpOutcome;
