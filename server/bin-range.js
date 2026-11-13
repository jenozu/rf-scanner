// Bin-range helpers for counting locks.
//
// Bin codes are text, but they are usually numbered (01-A-2, 01-A-10). Plain
// string comparison puts "01-A-10" before "01-A-2", so ranges must compare
// numeric runs as numbers.

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function normaliseBin(code) {
  return String(code ?? '').trim();
}

// Negative when a sorts before b, positive when after, 0 when equal (ignoring case).
export function compareBinCodes(a, b) {
  return collator.compare(normaliseBin(a), normaliseBin(b));
}

// Returns [low, high] for a range given in either order (start may be after end).
export function orderedRange(startBin, endBin) {
  const s = normaliseBin(startBin);
  const e = normaliseBin(endBin);
  return compareBinCodes(s, e) <= 0 ? [s, e] : [e, s];
}

export function binRangesOverlap(startA, endA, startB, endB) {
  const [aLow, aHigh] = orderedRange(startA, endA);
  const [bLow, bHigh] = orderedRange(startB, endB);
  return compareBinCodes(aLow, bHigh) <= 0 && compareBinCodes(bLow, aHigh) <= 0;
}

export const BIN_LOCK_TTL_MS = 24 * 60 * 60 * 1000;

export function isLockFresh(lock, now) {
  const lockedAt = new Date(lock.lockedAt).getTime();
  return Number.isFinite(lockedAt) && now - lockedAt < BIN_LOCK_TTL_MS;
}

// Locks held by other sessions that are still fresh and overlap the requested range.
export function findBinLockConflicts(locks, { startBin, endBin, sessionId, now = Date.now() }) {
  return (locks || []).filter(lock =>
    lock.sessionId !== sessionId &&
    isLockFresh(lock, now) &&
    binRangesOverlap(startBin, endBin, lock.startBin, lock.endBin));
}
