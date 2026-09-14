// Pure full-match path builder for the 3D playthrough (no React/store).
// Runs on the REAL match clock (AUTO 0-20, TELEOP 20-160) with REAL
// motion-model travel times, so robots work the whole match instead of
// finishing early and parking (which reads as "frozen").
//
// Anti-dither rules (robots must never jitter or shuttle in place):
// - consecutive transit points closer than MIN_STEP_IN are merged
// - legs shorter than MIN_LEG_IN become a short dwell, not a drive
// - travel lanes alternate sides per leg so repeat cycles paint fresh lines
// - each slot aims at a different patch of shared areas (anchor fan)
import { astar, clampOutOfColliders, fieldGridFromConstants } from './nav';
import { estimateSegment } from './motion';
import { hubWindows, isActiveAt } from './scoring';
import { shotHit, jamThisCycle } from './shots';

export const MATCH_LEN = 160;
export const MIN_STEP_IN = 2.5;
export const MIN_LEG_IN = 24;

export const ALLIANCE_LINE_IN = 167.01; // ROBOT STARTING LINE |x|
export const BUMPER_TOL_IN = 14; // bumper-partially-inside allowance (~half footprint)

// G407: launch position is legal only with BUMPERS partially/fully inside
// the shooter's own ALLIANCE ZONE (MAJOR FOUL per launch otherwise).
export function inAllianceZone(p: { x: number; y: number }, alliance: 'red' | 'blue'): boolean {
  return alliance === 'blue' ? p.x <= -ALLIANCE_LINE_IN + BUMPER_TOL_IN : p.x >= ALLIANCE_LINE_IN - BUMPER_TOL_IN;
}

// Alliance-side HUB aprons: legal, collision-free, close-range release spots.
const SHOT_APRONS: Record<'red' | 'blue', { x: number; y: number }[]> = {
  blue: [{ x: -185, y: 55 }, { x: -185, y: -55 }, { x: -215, y: 0 }],
  red: [{ x: 185, y: 55 }, { x: 185, y: -55 }, { x: 215, y: 0 }],
};

export function legalShotSpot(from: { x: number; y: number }, alliance: 'red' | 'blue', slot: number) {
  if (inAllianceZone(from, alliance)) return { p: from, moved: false };
  const a = SHOT_APRONS[alliance][Math.min(Math.max(slot, 0), 2) % 3];
  return { p: clampOutOfColliders(a), moved: true };
}

export interface DensePt { x: number; y: number; t: number; label: string; active: boolean; carry: number; hd: number }
export interface ShotEvt { t: number; x: number; y: number; hit: boolean; fuel: number }
export interface PickupEvt { t: number; x: number; y: number; jam: boolean }

const PTS: Record<string, { x: number; y: number }> = {
  neutralCenter: { x: 0, y: 0 }, hubScore: { x: -110, y: 20 },
  depotApproach: { x: -280, y: 100 }, outpostApproach: { x: -270, y: -120 },
  towerApproach: { x: -258, y: 0 }, start: { x: -230, y: -20 },
  hubAdjacent: { x: -140, y: 20 }, shootZone: { x: -100, y: 60 },
  reload: { x: -60, y: 40 }, neutral: { x: 0, y: 0 },
  corral: { x: -260, y: -100 }, 'lane-block': { x: -60, y: -80 },
  allianceZone: { x: -250, y: 0 },
};

const SLOT_ANCHOR = [{ x: 0, y: 0 }, { x: -18, y: -36 }, { x: 18, y: 36 }];
const SLOT_LANE = [0, 16, -16];

export interface PlayOpts {
  robot: any;
  routeSeq: string[];
  alliance: 'red' | 'blue';
  autoWinner: 'red' | 'blue' | 'tie';
  zone: 'close' | 'mid' | 'long';
  climbLevel: 0 | 1 | 2 | 3;
  endgameId: string;
  congestion: number;
  defense: number;
  origin: { x: number; y: number };
  gridIn: number;
  slot: number;
  role: string;
}

export interface PlayResult {
  path: DensePt[];
  shots: ShotEvt[];
  pickups: PickupEvt[];
  hubX: number;
}

export function buildPlaythrough(o: PlayOpts): PlayResult {
  const R: any = o.robot;
  const slot = Math.min(Math.max(o.slot, 0), 2);
  const tag = `R${slot + 1}`;
  const windows = hubWindows(o.alliance, o.autoWinner);
  const grid = fieldGridFromConstants(o.gridIn, 29);
  const anchor = SLOT_ANCHOR[slot] ?? { x: 0, y: 0 };
  const laneBase = SLOT_LANE[slot] ?? 0;
  const at = (n: string) => {
    const p = PTS[n] ?? PTS.neutralCenter;
    const m = o.alliance === 'blue' ? { x: p.x, y: p.y } : { x: -p.x, y: -p.y };
    return clampOutOfColliders({ x: m.x + anchor.x, y: m.y + anchor.y });
  };
    const hubX = o.alliance === 'blue' ? -167.01 : 167.01;
    // Scoring releases happen at this slot's alliance-side apron (G407-legal
    // by construction); anything else routes through legalShotSpot below.
    const hubApron = () => {
      const a = SHOT_APRONS[o.alliance][slot % 3];
      return clampOutOfColliders({ x: a.x, y: a.y });
    };
  const acc = R.accuracy?.[o.zone] ?? 0.8;
  const accClose = R.accuracy?.close ?? 0.85;
  const intake = Math.max(R.intakeRatePerSec ?? 1.5, 0.2);
  const release = Math.max(R.releaseRatePerSec ?? 1.8, 0.2);
  const carryN = Math.min(R.storage ?? 14, 8 + Math.round(intake * 3));
  const autoFuel = Math.round(8 * accClose);
  const mp = {
    vmaxInPerSec: R.vmaxInPerSec, amaxInPerSec2: R.amaxInPerSec2,
    brakeInPerSec2: R.brakeInPerSec2, omegaDegPerSec: R.omegaDegPerSec,
    turnAccelDegPerSec2: R.turnAccelDegPerSec2, batteryDerate: R.batteryDerate ?? 1,
    congestionSec: o.congestion, defenseSec: o.defense, driverNoise: 0.06,
    curvatureFactor: 0.12 + (1 - (R.maneuver ?? 0.75)) * 0.15,
  };

  const dense: DensePt[] = [];
  const shots: ShotEvt[] = [];
  const pickups: PickupEvt[] = [];
  let t = 0;
  let hd = 0;
  let flip = 1;
  let cursor = clampOutOfColliders({ x: o.origin.x + anchor.x, y: o.origin.y + anchor.y });

  const last = () => dense[dense.length - 1];
  const pushTransit = (x: number, y: number, dt: number, carry: number, label: string, active: boolean, segHd: number) => {
    const prev = last();
    // drop silent micro-steps entirely (no clock advance) instead of jittering;
    // labeled waypoint arrivals are always kept so captions/carry stay in sync
    if (prev && !label && Math.hypot(x - prev.x, y - prev.y) < MIN_STEP_IN) return;
    t += dt;
    dense.push({ x, y, t, label, active, carry, hd: segHd });
  };

  const driveTo = (target: { x: number; y: number }, label: string, active: boolean, carry: number) => {
    if (Math.hypot(target.x - cursor.x, target.y - cursor.y) < MIN_LEG_IN) {
      dwell(1.5, label || 'Reposition', active, carry);
      cursor = { x: target.x, y: target.y };
      return;
    }
    const lane = laneBase * flip;
    flip *= -1; // alternate sides each leg: repeat cycles paint fresh lines
    const leg = astar(cursor, target, grid);
    const pts = leg.reachable && leg.points.length > 1 ? leg.points : [cursor, target];
    const segLens = pts.map((p, k) => (k ? Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y) : 0));
    const totalLen = segLens.reduce((a, b) => a + b, 0);
    const legT = totalLen < 1 ? 0.1 : estimateSegment(totalLen, 40, mp).realisticSec;
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k];
      const prev = pts[k - 1];
      const dx = p.x - prev.x, dy = p.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const isEnd = k === pts.length - 1;
      const off = isEnd ? 0 : lane;
      const safe = clampOutOfColliders({ x: p.x + (-dy / len) * off, y: p.y + (dx / len) * off });
      hd = Math.atan2(safe.y - prev.y, safe.x - prev.x) || hd;
      const dt = Math.max(0.05, legT * (segLens[k] / Math.max(totalLen, 0.001)));
      pushTransit(safe.x, safe.y, dt, isEnd ? carry : last()?.carry ?? carry, isEnd ? label : '', active, hd);
    }
    cursor = { x: target.x, y: target.y };
  };

  const dwell = (secs: number, label: string, active: boolean, carry: number) => {
    if (secs <= 0.05) return;
    t += secs;
    dense.push({ x: cursor.x, y: cursor.y, t, label, active, carry, hd });
  };

  const nextActiveStart = (now: number) => {
    for (const w of windows.active) if (w.start > now + 0.5) return w.start;
    return -1;
  };

  const collectDwell = Math.min((carryN / intake) * (1 + (R.intakeFail ?? 0.07) * 2), 9);
  const scoreDwell = Math.min((R.spinUpSec ?? 0.6) + carryN / release, 7);

  dense.push({ x: cursor.x, y: cursor.y, t: 0, label: `${tag} Start — AUTO rollout`, active: true, carry: 0, hd: 0 });

  // ---- AUTO 0-20: preloads to the (always active) HUB, then stage ----
  // G407: releases require BUMPERS in the ALLIANCE ZONE, so scoring runs
  // stage on this slot's alliance-side apron, never mid-field.
  driveTo(hubApron(), '', true, 0);
  if (t < 14) {
    const arrT = t;
    dwell(2.5, `${tag} AUTO score ✓`, true, 0);
    if (arrT <= 19) shots.push({ t: arrT + 0.4, x: cursor.x, y: cursor.y, hit: hashSlot(slot, accClose), fuel: autoFuel });
  }
  if (t < 15) driveTo(at('neutralCenter'), '', true, 0);
  if (t < 20) dwell(20 - t, 'AUTO end — teleop soon', true, 0);

  // ---- TELEOP 20-160 ----
  const cutoff = o.endgameId === 'end-skip' ? 0 : o.endgameId === 'end-late' ? 12 : 30;
  const seq = o.routeSeq.length ? o.routeSeq : ['neutralCenter'];
  let c = 0;

  const scorerCycle = (idx: number): boolean => {
    if (t > 150) return false;
    const raw = seq[idx % seq.length] ?? 'neutralCenter';
    const target = raw === 'hubScore' || raw === 'shoot' || raw === 'repeat' ? 'neutralCenter' : raw;
    driveTo(at(target), '', true, 0);
    const jam = jamThisCycle(idx, slot, R.jamProb ?? 0.02);
    const arrT = t;
    dwell(collectDwell * (jam ? 1.8 : 1), jam ? `${tag} JAM — clearing` : `${tag} Collect ${idx + 1}`, true, 1);
    if (arrT <= 159) pickups.push({ t: arrT, x: cursor.x, y: cursor.y, jam });
    driveTo(hubApron(), '', true, 1);
    {
      // Backstop: any release outside the ALLIANCE ZONE is a G407 MAJOR
      // FOUL, so reroute to the apron (visible Reposition leg, real time).
      const spot = legalShotSpot(cursor, o.alliance, slot);
      if (spot.moved) driveTo(spot.p, `${tag} Reposition — G407 zone`, isActiveAt(t, windows), 1);
    }
    // Wait out inactive windows (re-check after capped holds — never shoot while off).
    let guard = 0;
    while (!isActiveAt(t, windows) && guard++ < 3) {
      const ns = nextActiveStart(t);
      dwell(ns < 0 ? 3 : Math.min(ns - t, 15), `${tag} Hold — HUB off`, false, 1);
    }
    if (!isActiveAt(t, windows)) {
      dwell(1, `${tag} Hold — HUB off`, false, 1);
    } else {
      // Balls leave at the start of the release; verify the HUB is live
      // at that exact instant (a window can expire mid-aim).
      const shotT = t + 0.5;
      if (!isActiveAt(shotT, windows)) {
        dwell(1, `${tag} Hold — HUB off`, false, 1);
      } else {
        const hit = shotHit(idx, slot, acc);
        dwell(scoreDwell, `${tag} Score ${idx + 1} ✓`, true, 0);
        if (shotT <= 159.5) shots.push({ t: shotT, x: cursor.x, y: cursor.y, hit, fuel: hit ? carryN : 0 });
      }
    }
    return true;
  };

  if (o.role === 'support') {
    while (t < 150 - (cutoff ? 10 : 0) && c < 8) {
      driveTo(at('depotApproach'), '', true, 0);
      const arrT = t;
      dwell(collectDwell * 0.7, `${tag} Collect ${c + 1}`, true, 1);
      if (arrT <= 159) pickups.push({ t: arrT, x: cursor.x, y: cursor.y, jam: false });
      driveTo(at('corral'), `${tag} Feed ${c + 1}`, true, 1);
      dwell(2, '', true, 0);
      if (t <= 159) pickups.push({ t, x: cursor.x, y: cursor.y, jam: false });
      c++;
    }
  } else if (o.role === 'defense') {
    while (t < 152 && c < 8) {
      driveTo(at(c % 2 ? 'neutralCenter' : 'lane-block'), `${tag} Patrol`, true, 0);
      dwell(3, '', true, 0);
      c++;
    }
  } else {
    // scorer (+ climb-early): neutral collect → HUB score until tower time
    while (t < 150 - (cutoff ? 20 : 4) && c < 8) {
      if (o.role === 'climb' && c >= 2) break;
      if (!scorerCycle(c)) break;
      c++;
    }
  }

  // ---- ENDGAME ----
  const wantsClimb = o.climbLevel > 0 && (slot === 0 || o.role === 'climb' || o.role === 'scorer');
  if (wantsClimb && o.climbLevel > 0) {
    driveTo(at('towerApproach'), `${tag} Climb L${o.climbLevel}`, true, 0);
    dwell(Math.min(R.climb?.setupSec ?? 8, 9), '', true, 0);
  } else {
    // non-climbers rejoin scoring instead of parking with dead time
    let extra = 0;
    while (t < 150 && extra < 2) {
      if (!scorerCycle(c++)) break;
      extra++;
    }
    if (t < MATCH_LEN) {
      driveTo(at('neutralCenter'), `${tag} Match end — parked`, isActiveAt(t, windows), 0);
    }
  }
  if (t < MATCH_LEN) dwell(MATCH_LEN - t, wantsClimb && o.climbLevel > 0 ? `${tag} Climbed — match end` : `${tag} Match end — parked`, isActiveAt(MATCH_LEN - 0.5, windows), 0);

  return { path: dense, shots, pickups, hubX };
}

// Deterministic AUTO conversion (stable while scrubbing).
function hashSlot(slot: number, acc: number): boolean {
  const v = Math.sin(slot * 91.7 + 3.3) * 43758.5453;
  return v - Math.floor(v) < acc;
}
