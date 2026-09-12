// Scoring model: active-HUB gating + tower + RP progress. All estimates, never guarantees.
export type Alliance = 'red' | 'blue';
export interface HubWindows { active: { start: number; end: number }[]; label: string }
// Match clock: t=0 at AUTO start; AUTO 0-20; gap not modeled; TELEOP 20-160 with
// TRANSITION 20-30, SHIFT1 30-55, SHIFT2 55-80, SHIFT3 80-105, SHIFT4 105-130, ENDGAME 130-160.

export function hubWindows(alliance: Alliance, autoWinner: Alliance | 'tie'): HubWindows {
  // Both active AUTO(0-20)+TRANSITION(20-30)+ENDGAME(130-160). Alternating SHIFTS per Table 6-3.
  const winner: Alliance = autoWinner === 'tie' ? 'red' : autoWinner; // FMS random; caller seeds choice. Default red for determinism.
  const shifts: { s: number; e: number }[] = [
    { s: 30, e: 55 }, { s: 55, e: 80 }, { s: 80, e: 105 }, { s: 105, e: 130 },
  ];
  // If alliance won AUTO, its hub INACTIVE in SHIFT1, then alternates.
  const active: { start: number; end: number }[] = [
    { start: 0, end: 30 },
    { start: 130, end: 163 }, // +3s processing tail
  ];
  shifts.forEach((sh, i) => {
    const wonAuto = alliance === winner;
    const inactiveFirst = wonAuto;
    const isInactive = (i % 2 === 0) === inactiveFirst;
    if (!isInactive) active.push({ start: sh.s, end: i === 3 ? sh.e : sh.e + 0 }); // +3s tail only modeled at ENDGAME boundary
  });
  // +3s tail after each active window that precedes an inactive one is modeled as scorer-side grace in strategy sim.
  return { active, label: `${alliance} hub; AUTO winner=${winner}` };
}

export function isActiveAt(t: number, w: HubWindows): boolean {
  return w.active.some((a) => t >= a.start && t < a.end);
}

export interface CycleEvent { tScore: number; fuel: number; zone: 'close' | 'mid' | 'long' }
export interface ScoreInput {
  alliance: Alliance;
  autoWinner: Alliance | 'tie';
  autoFuel: number; // scored (active, AUTO both active so all count)
  cycles: CycleEvent[]; // TELEOP+ENDGAME score attempts with timestamps
  accuracy: { close: number; mid: number; long: number };
  jamLoss: number;
  climb: { level: 0 | 1 | 2 | 3; period: 'AUTO' | 'TELEOP' | 'NONE'; autoL1?: boolean };
  points?: { fuelAuto: number; fuelTele: number; autoL1: number; teleL1: number; teleL2: number; teleL3: number };
}

export interface ScoreOutput {
  autoFuel: number; teleActive: number; teleInactiveAttempted: number;
  missed: number; jamLoss: number;
  fuelPoints: number; towerPoints: number; total: number;
  rpProgress: { energized: number; supercharged: number; traversalPts: number };
  windows: HubWindows;
}

export function scoreMatch(inp: ScoreInput): ScoreOutput {
  const p = inp.points ?? { fuelAuto: 1, fuelTele: 1, autoL1: 15, teleL1: 10, teleL2: 20, teleL3: 30 };
  const windows = hubWindows(inp.alliance, inp.autoWinner);
  let teleActive = 0, inactive = 0, missed = 0;
  for (const c of inp.cycles) {
    const acc = inp.accuracy[c.zone] ?? 0.8;
    const made = c.fuel * acc;
    missed += c.fuel - made;
    if (isActiveAt(c.tScore, windows)) teleActive += made;
    else inactive += c.fuel; // attempted during inactive: 0 pts, visible lost time
  }
  const fuelPoints = inp.autoFuel * p.fuelAuto + teleActive * p.fuelTele;
  let tower = 0;
  if (inp.climb.period === 'AUTO' && inp.climb.level >= 1) tower += p.autoL1;
  if (inp.climb.period === 'TELEOP') {
    if (inp.climb.level === 1) tower += p.teleL1;
    if (inp.climb.level === 2) tower += p.teleL2;
    if (inp.climb.level === 3) tower += p.teleL3;
  }
  const totalFuel = inp.autoFuel + teleActive;
  return {
    autoFuel: inp.autoFuel, teleActive, teleInactiveAttempted: inactive,
    missed, jamLoss: inp.jamLoss, fuelPoints, towerPoints: tower, total: fuelPoints + tower,
    rpProgress: { energized: totalFuel, supercharged: totalFuel, traversalPts: tower },
    windows,
  };
}
