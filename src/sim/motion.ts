// Explainable trapezoidal / triangular motion model.
// Never time = distance / vmax alone.

export interface MotionParams {
  vmaxInPerSec: number;
  amaxInPerSec2: number;
  brakeInPerSec2: number;
  omegaDegPerSec: number;
  turnAccelDegPerSec2: number;
  batteryDerate?: number; // 0..1 multiplier on vmax/accel
  tractionPenalty?: number; // >=0 extra time fraction on bump/curve
  congestionSec?: number; // additive per-segment traffic cost
  defenseSec?: number; // additive disruption cost
  driverNoise?: number; // fraction added for consistency (0.05 = +5%)
  curvatureFactor?: number; // per 90deg of path curvature, seconds
}

export interface SegmentEstimate {
  distanceIn: number;
  turnDeg: number;
  bestSec: number;
  realisticSec: number;
  conservativeSec: number;
  assumptions: string[];
}

export function trapezoidTime(distanceIn: number, vmax: number, accel: number, decel: number): number {
  if (distanceIn <= 0) return 0;
  if (vmax <= 0 || accel <= 0 || decel <= 0) throw new Error('Invalid motion limits');
  const tAcc = vmax / accel;
  const dAcc = 0.5 * accel * tAcc * tAcc;
  const tDec = vmax / decel;
  const dDec = 0.5 * decel * tDec * tDec;
  if (distanceIn >= dAcc + dDec) {
    const dCruise = distanceIn - dAcc - dDec;
    return tAcc + dCruise / vmax + tDec;
  }
  // Triangular: peak v below vmax
  const vPeak = Math.sqrt(distanceIn / (1 / (2 * accel) + 1 / (2 * decel)));
  return vPeak / accel + vPeak / decel;
}

export function turnTime(turnDeg: number, omega: number, turnAccel: number): number {
  const a = Math.abs(turnDeg);
  if (a < 1e-6) return 0;
  const tSpin = a / Math.max(omega, 1);
  const tRamp = Math.max(omega, 1) / Math.max(turnAccel, 1);
  return tSpin + Math.min(tRamp * 0.5, 0.4);
}

export function estimateSegment(distanceIn: number, turnDeg: number, p: MotionParams): SegmentEstimate {
  const derate = p.batteryDerate ?? 1;
  const vmax = p.vmaxInPerSec * derate;
  const accel = p.amaxInPerSec2 * derate;
  const brake = p.brakeInPerSec2 * derate;
  const base = trapezoidTime(distanceIn, vmax, accel, brake) + turnTime(turnDeg, p.omegaDegPerSec, p.turnAccelDegPerSec2);
  const curve = ((p.curvatureFactor ?? 0.12) * Math.abs(turnDeg)) / 90;
  const traction = base * (p.tractionPenalty ?? 0);
  const realistic = base + curve + traction + (p.congestionSec ?? 0) + (p.defenseSec ?? 0);
  const withDriver = realistic * (1 + (p.driverNoise ?? 0.06));
  const conservative = withDriver * 1.18 + 0.25;
  const assumptions = [
    `Trapezoidal profile vmax=${vmax.toFixed(0)}in/s accel=${accel.toFixed(0)}in/s² brake=${brake.toFixed(0)}in/s² (derate ${derate})`,
    `Turn ${turnDeg.toFixed(0)}° @ ${p.omegaDegPerSec}°/s`,
    `Curve cost ${curve.toFixed(2)}s, traction +${traction.toFixed(2)}s, congestion +${(p.congestionSec ?? 0).toFixed(2)}s, defense +${(p.defenseSec ?? 0).toFixed(2)}s`,
    `Driver noise ${(100 * (p.driverNoise ?? 0.06)).toFixed(0)}%; conservative = realistic*1.18+0.25s`,
  ];
  return { distanceIn, turnDeg, bestSec: base, realisticSec: withDriver, conservativeSec: conservative, assumptions };
}

export function estimateRoute(legs: { d: number; turn: number }[], p: MotionParams): SegmentEstimate {
  let dist = 0, best = 0, real = 0, cons = 0;
  const assumptions = new Set<string>();
  for (const leg of legs) {
    const s = estimateSegment(leg.d, leg.turn, p);
    dist += s.distanceIn; best += s.bestSec; real += s.realisticSec; cons += s.conservativeSec;
    s.assumptions.forEach((a) => assumptions.add(a));
  }
  return { distanceIn: dist, turnDeg: legs.reduce((a, l) => a + Math.abs(l.turn), 0), bestSec: best, realisticSec: real, conservativeSec: cons, assumptions: [...assumptions] };
}
