// Whole-warehouse dashboard numbers, computed on the server from the shared files.
// Orders are the sales orders; waves are the pick waves (rf_pick_waves), and a wave is active
// until none of its orders has an open line. The legacy rf_orders / rf_waves files are no longer read.
import { waveProgress } from './waves.js';

const asArray = (v) => (Array.isArray(v) ? v : []);
const time = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
};

export function computeDashboard({
  purchaseOrders, salesOrders, pickWaves, cycleCounts, bins,
  receivingTxns, countTxns, countVariances, now = new Date(),
}) {
  const pos = asArray(purchaseOrders);
  const sos = asArray(salesOrders);
  const sosById = Object.fromEntries(sos.map((s) => [s.id, s]));
  const counts = asArray(cycleCounts);
  const receiving = asArray(receivingTxns);
  const countLog = asArray(countTxns);
  const variances = asArray(countVariances);

  const completedCounts = counts.filter(c => c.Status === 'completed');
  const accurate = completedCounts.filter(c => c.Variance === 0).length;

  const stats = {
    pendingPOs: pos.filter(p => p.status === 'pending').length,
    receivingPOs: pos.filter(p => p.status === 'receiving').length,
    pendingOrders: sos.filter(o => o.status === 'pending' || o.status === 'picking').length,
    activeWaves: asArray(pickWaves).filter(w => waveProgress(w, sosById).status !== 'completed').length,
    pendingCounts: counts.filter(c => c.Status === 'pending').length,
    completedCounts: completedCounts.length,
    totalBins: asArray(bins).length,
    accuracy: completedCounts.length > 0 ? Math.round((accurate / completedCounts.length) * 100) : 0,
    readyToShip: sos.filter(o => o.status === 'picked').length,
    shipped: sos.filter(o => o.status === 'shipped').length,
    pendingApprovals: variances.filter(v => v.status === 'pending').length,
  };

  const entries = [
    ...receiving.map(txn => ({
      id: txn.id,
      title: 'Receiving posted',
      detail: `${txn.poNumber} · ${txn.qty} × ${txn.itemCode} → ${txn.binCode}`,
      tone: 'good',
      timestamp: txn.timestamp,
    })),
    ...countLog.map(txn => ({
      id: txn.id,
      title: txn.variance === 0 ? 'Count verified' : 'Variance detected',
      detail: `${txn.binCode} · ${txn.itemCode} · ${txn.variance > 0 ? '+' : ''}${txn.variance}`,
      tone: txn.variance === 0 ? 'good' : 'warn',
      timestamp: txn.timestamp,
    })),
    ...sos
      .filter(o => o.status === 'shipped' && o.shippedDate)
      .map(o => ({
        id: `ship-${o.id}`,
        title: 'Shipment confirmed',
        detail: `${o.soNumber} · ${o.customer}${o.shipmentPin ? ` · ${o.shipmentPin}` : ''}`,
        tone: 'good',
        timestamp: o.shippedDate,
      })),
  ]
    .map(e => ({ ...e, stamp: time(e.timestamp) }))
    .filter(e => Number.isFinite(e.stamp))
    .sort((a, b) => b.stamp - a.stamp)
    .slice(0, 6)
    .map(({ stamp, ...e }) => e);

  return { generatedAt: now.toISOString(), stats, timeline: entries };
}
