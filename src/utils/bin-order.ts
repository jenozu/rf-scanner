// Numeric-aware bin ordering for counting ranges.
// Keep in step with server/bin-range.js (the server re-checks locks with the same rules).
// Plain string comparison puts "10" before "2", which dropped bins from ranges.

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareBinCodes(a: string, b: string): number {
  return collator.compare(a.trim(), b.trim());
}

/** True when `bin` falls inside [startBin, endBin] in either order. */
export function isBinInRange(bin: string, startBin: string, endBin: string): boolean {
  const [low, high] = compareBinCodes(startBin, endBin) <= 0 ? [startBin, endBin] : [endBin, startBin];
  return compareBinCodes(bin, low) >= 0 && compareBinCodes(bin, high) <= 0;
}
