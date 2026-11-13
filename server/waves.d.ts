export interface WaveProgress { status: 'open' | 'picking' | 'completed'; openLines: number; pickedLines: number; totalLines: number; orderCount: number }
export function waveMembers(wave: { soIds?: string[] } | null | undefined, sosById: Record<string, any>): any[];
export function waveProgress(wave: { soIds?: string[] }, sosById: Record<string, any>): WaveProgress;
export function ordersInOpenWaves(waves: any[] | null | undefined, sosById: Record<string, any>): Set<string>;
export function hasPickedLines(so: any): boolean;
export function hasOpenLines(so: any): boolean;
