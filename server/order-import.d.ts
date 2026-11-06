import type { OpFailure, OpOutcome } from "./ops-logic.js";

export interface ImportedLine { LineNumber: number; ItemCode: string; Description?: string; OrderedQty: number; ReceivedQty?: number; DeliveredQty?: number; BinCode?: string; Warehouse?: string }
export interface ImportedOrder { poNumber?: string; soNumber?: string; vendor?: string; customer?: string; cardCode?: string; expectedDate?: string; dueDate?: string; items: ImportedLine[]; [extra: string]: unknown }
export interface ImportBody { kind: "po" | "so"; orders: ImportedOrder[] }

export interface ImportLineCounts { added: number; updated: number; unchanged: number; closed: number; reopened: number }
export interface ImportNote { code: string; docNum: string; lineKey?: string; message: string }
export interface ImportResult {
  ok: true;
  kind: "po" | "so";
  added: number;
  updated: number;
  unchanged: number;
  lines: ImportLineCounts;
  conflicts: ImportNote[];
  notes: ImportNote[];
  orders: Array<{ id: string; docNum: string; outcome: "added" | "updated" | "unchanged" | "conflict"; lines?: ImportLineCounts }>;
}

export function importCollection(kind: "po" | "so"): string;
export function validateOrderImport(body: unknown): OpFailure | null;
export function applyOrderImport(current: any[] | null, body: ImportBody, user?: { username?: string } | null, now?: Date): OpOutcome<ImportResult>;
