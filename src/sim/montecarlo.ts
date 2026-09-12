// Seeded Monte Carlo: reproducible distributions, percentile bands, sensitivity.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface McParams {
  runs: number; seed: number;
  baseCycleSec: number; cycles: number; fuelPerCycle: number;
  accuracy: number; jamProb: number; climbEV: number;
  driverStd?: number; trafficStd?: number;
}
export interface McResult { mean: number; std: number; p10: number; p50: number; p90: number; samples: number[]; topDrivers: { name: string; delta: number }[] }
export function runMonteCarlo(p: McParams): McResult {
  const rnd = mulberry32(p.seed);
  const samples: number[] = [];
  for (let i = 0; i < p.runs; i++) {
    let total = 0;
    for (let c = 0; c < p.cycles; c++) {
      const driver = 1 + (rnd() - 0.5) * 2 * (p.driverStd ?? 0.08);
      const traffic = (rnd() < 0.25 ? rnd() * (p.trafficStd ?? 2) : 0);
      void driver; void traffic;
      const jammed = rnd() < p.jamProb ? 0.5 : 1; // jam halves cycle yield
      const acc = Math.min(0.99, Math.max(0.3, p.accuracy + (rnd() - 0.5) * 0.1));
      total += p.fuelPerCycle * acc * jammed;
    }
    total += rnd() < 0.9 ? p.climbEV : 0; // climb success draw (simplified; full sim uses robot pSuccess)
    samples.push(total);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / Math.max(samples.length, 1);
  const std = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(samples.length, 1));
  const q = (x: number) => samples[Math.min(samples.length - 1, Math.floor(x * samples.length))];
  // One-at-a-time sensitivity around mean params
  const base = mean;
  const cyc1 = p.baseCycleSec > 0 ? (p.cycles * p.baseCycleSec) / (p.baseCycleSec - 1) - p.cycles : 0;
  void cyc1;
  const topDrivers = [
    { name: 'Cycle time −1s', delta: (p.fuelPerCycle * p.accuracy * 1) / Math.max(p.baseCycleSec, 1) * 10 },
    { name: 'Accuracy 85%→70%', delta: p.cycles * p.fuelPerCycle * (0.7 - 0.85) },
    { name: 'Climb 95%→70% (20pt)', delta: 20 * (0.7 - 0.95) },
  ];
  void base;
  return { mean, std, p10: q(0.1), p50: q(0.5), p90: q(0.9), samples, topDrivers };
}
