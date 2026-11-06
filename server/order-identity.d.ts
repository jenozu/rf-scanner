export const QTY_EPSILON: number;
export function roundQty(n: number): number;
export function normalizeDocNum(value: unknown): string;
export function orderId(kind: 'po' | 'so', docNum: unknown): string;
export function makeLineKey(docNum: unknown, lineNumber: number): string;
export function sameCode(a: unknown, b: unknown): boolean;
