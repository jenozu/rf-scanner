// Pick waves: a wave is a group of sales orders picked together, line by line, by bin.
// The wave holds the sales-order ids and a list of the lines picked *after* it was created
// (`picked`). Lines delivered before the wave existed are not the wave's work, so they do not
// count as wave progress and do not stop the wave from being deleted.
import { QTY_EPSILON } from './order-identity.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Lines a picker still has to deal with: everything SAP still lists.
const liveLines = (so) => (Array.isArray(so?.items) ? so.items.filter((i) => !i.SapClosed) : []);

// How a picked line is recorded on a wave. Lines without a LineKey (orders from before line
// keys) fall back to their SAP line number.
export function wavePickKey(soId, line) {
  return `${soId}|${line?.LineKey ?? `#${line?.LineNumber ?? ''}`}`;
}

export function waveMembers(wave, sosById) {
  return (wave?.soIds || []).map((id) => sosById[id]).filter(Boolean);
}

// status: 'open' (nothing picked in this wave yet), 'picking' (some picked in the wave, some open),
// 'completed' (no open line left).
export function waveProgress(wave, sosById) {
  const members = waveMembers(wave, sosById);
  const lines = members.flatMap(liveLines);
  const openLines = lines.filter((i) => num(i.RemainingQty) > QTY_EPSILON).length;
  const pickedLines = new Set(wave?.picked || []).size;
  let status = 'open';
  if (members.length > 0 && openLines === 0) status = 'completed';
  else if (pickedLines > 0) status = 'picking';
  return { status, openLines, pickedLines, totalLines: lines.length, orderCount: members.length };
}

// The wave still in progress that holds this sales order, if any (an order is in at most one).
export function openWaveFor(waves, sosById, soId) {
  return (waves || []).find((w) => (w.soIds || []).includes(soId) && waveProgress(w, sosById).status !== 'completed');
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

// True once anything has been picked (or reported short) in this wave since it was created.
export function waveHasPicks(wave) {
  return (wave?.picked || []).length > 0;
}

export function hasOpenLines(so) {
  return liveLines(so).some((i) => num(i.RemainingQty) > QTY_EPSILON);
}
