export interface WaveProgress { status: 'open' | 'picking' | 'completed'; openLines: number; pickedLines: number; totalLines: number; orderCount: number }
export function wavePickKey(soId: string, line: { LineKey?: string; LineNumber?: number } | null | undefined): string;
export function waveMembers(wave: { soIds?: string[] } | null | undefined, sosById: Record<string, any>): any[];
export function waveProgress(wave: { soIds?: string[]; picked?: string[] }, sosById: Record<string, any>): WaveProgress;
export function openWaveFor<W extends { soIds?: string[]; picked?: string[] }>(waves: W[] | null | undefined, sosById: Record<string, any>, soId: string): W | undefined;
export function ordersInOpenWaves(waves: any[] | null | undefined, sosById: Record<string, any>): Set<string>;
export function waveHasPicks(wave: { picked?: string[] } | null | undefined): boolean;
export function hasOpenLines(so: any): boolean;
