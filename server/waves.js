// Pick waves: a wave is a group of sales orders picked together, line by line, by bin.
// The wave holds only sales-order ids. Its status is worked out from those orders, so the server
// and the pick screen always agree and nothing has to be kept in step.
import { QTY_EPSILON } from './order-identity.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Lines a picker still has to deal with: everything SAP still lists.
const liveLines = (so) => (Array.isArray(so?.items) ? so.items.filter((i) => !i.SapClosed) : []);

export function waveMembers(wave, sosById) {
  return (wave?.soIds || []).map((id) => sosById[id]).filter(Boolean);
}

// status: 'open' (nothing picked yet), 'picking' (some picked, some open), 'completed' (no open line left).
export function waveProgress(wave, sosById) {
  const members = waveMembers(wave, sosById);
  const lines = members.flatMap(liveLines);
  const openLines = lines.filter((i) => num(i.RemainingQty) > QTY_EPSILON).length;
  const pickedLines = lines.filter((i) => num(i.DeliveredQty) > 0 || i.ShortPick).length;
  let status = 'open';
  if (members.length > 0 && openLines === 0) status = 'completed';
  else if (pickedLines > 0) status = 'picking';
  return { status, openLines, pickedLines, totalLines: lines.length, orderCount: members.length };
}

// Sales orders that are already in a wave still in progress.
export function ordersInOpenWaves(waves, sosById) {
  const taken = new Set();
  for (const wave of waves || []) {
    if (waveProgress(wave, sosById).status === 'completed') continue;
    for (const id of wave.soIds || []) taken.add(id);
  }
  return taken;
}

// Any line, closed or not, that has been picked from or marked short.
export function hasPickedLines(so) {
  return (Array.isArray(so?.items) ? so.items : []).some((i) => num(i.DeliveredQty) > 0 || i.ShortPick);
}

export function hasOpenLines(so) {
  return liveLines(so).some((i) => num(i.RemainingQty) > QTY_EPSILON);
}
