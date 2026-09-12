// Strategy timeline: turns preset + robot + rules into timestamped single-robot plan.
// Single-team v1: no alliance coordination; defender modeled as penalty slider.
import { estimateSegment, MotionParams } from './motion';
import { astar, fieldGridFromConstants, Pt } from './nav';
import { hubWindows, isActiveAt, Alliance } from './scoring';

export interface RobotLike {
  vmaxInPerSec: number; amaxInPerSec2: number; brakeInPerSec2: number;
  omegaDegPerSec: number; turnAccelDegPerSec2: number;
  maneuver: number; batteryDerate: number;
  intakeRatePerSec: number; intakeFail: number; storage: number;
  releaseRatePerSec: number; spinUpSec: number;
  accuracy: { close: number; mid: number; long: number };
  jamProb: number; climb: { setupSec: number };
  footprintIn: { x: number; y: number };
  driverMod?: number;
}
export interface StrategyLike {
  id: string; phase: string; name: string;
  route: string[]; acquire?: string; cutoffSec?: number;
}
export interface TimelineEvt { t: number; kind: string; detail: string; fuel?: number }
export interface CyclePlan { events: TimelineEvt[]; scoreAttempts: { tScore: number; fuel: number; zone: 'close' | 'mid' | 'long' }[]; collectSec: number; travelSec: number; scoreSec: number; cycles: number; fuelCarried: number; lostInactiveSec: number }

const PTS: Record<string, Pt> = {
  start: { x: -230, y: -20 }, hubApproach: { x: -110, y: 20 }, hubScore: { x: -110, y: 20 },
  neutralCenter: { x: 0, y: 0 }, allianceZone: { x: -250, y: 0 },
  depotApproach: { x: -280, y: 100 }, outpostApproach: { x: -270, y: -120 },
  hubAdjacent: { x: -140, y: 20 }, shootZone: { x: -100, y: 60 }, shoot: { x: -100, y: 60 },
  reload: { x: -60, y: 40 }, towerApproach: { x: -280, y: 0 }, climb: { x: -303, y: 0 },
  'neutral': { x: 0, y: 0 }, 'corral': { x: -270, y: -100 }, 'lane-block': { x: -60, y: -80 },
};

export function planStrategy(robot: RobotLike, strategy: StrategyLike, opts: {
  alliance: Alliance; autoWinner: Alliance | 'tie';
  teleopBudgetSec?: number; endgameCutoffSec?: number; // seconds before end to leave for climb
  congestionSec?: number; defenseSec?: number; zone?: 'close' | 'mid' | 'long';
  climbLevel?: 0 | 1 | 2 | 3;
}): CyclePlan {
  const zone = opts.zone ?? 'close';
  const grid = fieldGridFromConstants(8, Math.max(robot.footprintIn.x, robot.footprintIn.y));
  const mp: MotionParams = {
    vmaxInPerSec: robot.vmaxInPerSec, amaxInPerSec2: robot.amaxInPerSec2,
    brakeInPerSec2: robot.brakeInPerSec2, omegaDegPerSec: robot.omegaDegPerSec,
    turnAccelDegPerSec2: robot.turnAccelDegPerSec2, batteryDerate: robot.batteryDerate,
    congestionSec: opts.congestionSec ?? 0.6, defenseSec: opts.defenseSec ?? 0,
    driverNoise: 0.06 * (robot.driverMod ?? 1), curvatureFactor: 0.12 + (1 - robot.maneuver) * 0.15,
  };
  const seq = strategy.route.length ? strategy.route : ['neutralCenter', 'hubScore'];
  const windows = hubWindows(opts.alliance, opts.autoWinner);
  const budget = opts.teleopBudgetSec ?? 140;
  const cutoff = opts.endgameCutoffSec ?? 30; // leave this many sec for climb (0 = skip)
  const driveable = Math.max(10, budget - cutoff);
  const events: TimelineEvt[] = [];
  const attempts: CyclePlan['scoreAttempts'] = [];
  let t = 20; // TELEOP clock base (AUTO 0-20 done separately)
  let pos: Pt = PTS[strategy.route[0]] ?? PTS.start;
  let cycles = 0, fuelCarriedTotal = 0, collectSec = 0, travelSec = 0, scoreSec = 0, lostInactive = 0;
  let guard = 40;
  while (t < 20 + driveable && guard-- > 0) {
    // one cycle: go collect -> go score
    const collectPt = PTS[seq[cycles % seq.length]] ?? PTS.neutralCenter;
    const scorePt = PTS.hubScore;
    const leg1 = astar(pos, collectPt, grid);
    const leg2 = astar(collectPt, scorePt, grid);
    if (!leg1.reachable || !leg2.reachable) { events.push({ t, kind: 'blocked', detail: 'Illegal target rejected — no path' }); break; }
    const s1 = estimateSegment(leg1.distanceIn, 45, mp);
    const s2 = estimateSegment(leg2.distanceIn, 45, mp);
    const carry = Math.min(robot.storage, 8 + Math.round(robot.intakeRatePerSec * 3));
    const tCollect = carry / Math.max(robot.intakeRatePerSec, 0.2) * (1 + robot.intakeFail * 2);
    const tScore = robot.spinUpSec + carry / Math.max(robot.releaseRatePerSec, 0.2);
    const tArrive = t + s1.realisticSec + tCollect + s2.realisticSec;
    const active = isActiveAt(tArrive, windows);
    events.push({ t, kind: 'travel', detail: `to collect (${leg1.distanceIn.toFixed(0)}in, ${s1.realisticSec.toFixed(1)}s)` });
    events.push({ t: t + s1.realisticSec, kind: 'collect', detail: `${carry} FUEL in ${tCollect.toFixed(1)}s`, fuel: carry });
    events.push({ t: t + s1.realisticSec + tCollect, kind: 'travel', detail: `to HUB (${leg2.distanceIn.toFixed(0)}in, ${s2.realisticSec.toFixed(1)}s)` });
    if (active) {
      events.push({ t: tArrive, kind: 'score', detail: `${carry} FUEL @${zone} (active)`, fuel: carry });
      attempts.push({ tScore: tArrive, fuel: carry, zone });
    } else {
      events.push({ t: tArrive, kind: 'wait-inactive', detail: `${carry} FUEL held — HUB inactive, collecting/repositioning` });
      lostInactive += tScore;
      // carry over: attempt counts as inactive-attempted for scoring transparency
      attempts.push({ tScore: tArrive, fuel: 0, zone });
    }
    travelSec += s1.realisticSec + s2.realisticSec;
    collectSec += tCollect; scoreSec += tScore;
    cycles++; fuelCarriedTotal += carry;
    pos = scorePt;
    t = tArrive + tScore + 1.0; // index/leave
  }
  if ((opts.climbLevel ?? 0) > 0) {
    events.push({ t: 20 + driveable, kind: 'climb', detail: `Depart for L${opts.climbLevel} climb (setup ${robot.climb.setupSec}s)` });
  }
  return { events, scoreAttempts: attempts.filter((a) => a.fuel > 0), collectSec, travelSec, scoreSec, cycles, fuelCarried: fuelCarriedTotal, lostInactiveSec: lostInactive };
}
