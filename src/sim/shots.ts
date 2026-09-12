// Deterministic per-cycle shot/jam outcomes for visualization.
// Seeded hash (no RNG state) so replays and scrubbing are stable frame-to-frame.
export function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// True when a scoring attempt of the given cycle converts, given zone accuracy.
export function shotHit(cycle: number, slot: number, accuracy: number): boolean {
  if (accuracy >= 1) return true;
  if (accuracy <= 0) return false;
  return hash01(cycle * 57.31 + slot * 131.7 + 7.7) < accuracy;
}

// True when a collection cycle jams, given per-cycle jam probability.
export function jamThisCycle(cycle: number, slot: number, jamProb: number): boolean {
  if (jamProb <= 0) return false;
  return hash01(cycle * 91.7 + slot * 47.3 + 3.1) < jamProb;
}
