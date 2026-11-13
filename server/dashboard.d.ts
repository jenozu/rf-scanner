export interface DashboardStats {
  pendingPOs: number; receivingPOs: number; pendingOrders: number; activeWaves: number;
  pendingCounts: number; completedCounts: number; totalBins: number; accuracy: number;
  readyToShip: number; shipped: number; pendingApprovals: number;
}
export interface DashboardTimelineEntry { id: string; title: string; detail: string; tone: 'good' | 'warn' | 'neutral'; timestamp: string }
export interface DashboardInput {
  purchaseOrders?: any[] | null; salesOrders?: any[] | null; orders?: any[] | null; waves?: any[] | null;
  cycleCounts?: any[] | null; bins?: any[] | null; receivingTxns?: any[] | null; countTxns?: any[] | null;
  countVariances?: any[] | null; now?: Date;
}
export function computeDashboard(input: DashboardInput): { generatedAt: string; stats: DashboardStats; timeline: DashboardTimelineEntry[] };
