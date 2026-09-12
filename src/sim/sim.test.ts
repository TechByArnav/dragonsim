import { describe, it, expect } from 'vitest';
import { trapezoidTime, estimateSegment } from './motion';
import { astar, clampOutOfColliders, colliderRects, fieldGridFromConstants } from './nav';
import { scoreMatch, hubWindows, isActiveAt } from './scoring';
import { planStrategy } from './strategy';
import { runMonteCarlo, mulberry32 } from './montecarlo';
import { shotHit, jamThisCycle, hash01 } from './shots';
import archetypes from '../../data/robots/archetypes.json';

describe('motion profiles', () => {
  it('trapezoid beats naive d/vmax and triangular handles short moves', () => {
    const t = trapezoidTime(300, 150, 120, 140);
    expect(t).toBeGreaterThan(300 / 150);
    const short = trapezoidTime(10, 150, 120, 140);
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(1);
  });
  it('route estimate gives best<=realistic<=conservative + assumptions', () => {
    const s = estimateSegment(200, 45, { vmaxInPerSec: 150, amaxInPerSec2: 110, brakeInPerSec2: 130, omegaDegPerSec: 320, turnAccelDegPerSec2: 640 });
    expect(s.bestSec).toBeLessThanOrEqual(s.realisticSec);
    expect(s.realisticSec).toBeLessThanOrEqual(s.conservativeSec);
    expect(s.assumptions.length).toBeGreaterThan(2);
  });
});

describe('pathfinding validity', () => {
  it('routes around hub and rejects illegal goals', () => {
    const g = fieldGridFromConstants(8, 29);
    const ok = astar({ x: -230, y: -20 }, { x: -110, y: 20 }, g);
    expect(ok.reachable).toBe(true);
    expect(ok.distanceIn).toBeGreaterThan(50);
    const bad = astar({ x: -230, y: 0 }, { x: -167.01, y: 0 }, g);
    expect(bad.reachable).toBe(false);
    expect(bad.reason).toMatch(/collision|path/i);
  });
  it('A* waypoints never enter hub/tower colliders and clamp rescues illegal points', () => {
    const g = fieldGridFromConstants(8, 29);
    const r = 14.5;
    const insideHub = clampOutOfColliders({ x: -167.01, y: 0 }, r);
    expect(Math.abs(insideHub.x + 167.01) > 23.5 + r - 0.5 || Math.abs(insideHub.y) > 23.5 + r - 0.5).toBe(true);
    const legs: [{ x: number; y: number }, { x: number; y: number }][] = [
      [{ x: -230, y: -20 }, { x: 0, y: 0 }],
      [{ x: 0, y: 0 }, { x: -110, y: 20 }],
      [{ x: -230, y: -20 }, { x: -280, y: 100 }],
    ];
    for (const [a, b] of legs) {
      const res = astar(a, b, g);
      expect(res.reachable).toBe(true);
      for (const p of res.points) {
        for (const o of colliderRects()) {
          const inX = Math.abs(p.x - o.cx) < o.hx + 4;
          const inY = Math.abs(p.y - o.cy) < o.hy + 4;
          expect(inX && inY).toBe(false);
        }
      }
    }
  });
});

describe('HUB scoring logic', () => {
  it('SHIFT1 follows AUTO winner and alternates', () => {
    const rw = hubWindows('red', 'red');
    expect(isActiveAt(40, rw)).toBe(false); // red won auto -> red inactive S1
    expect(isActiveAt(60, rw)).toBe(true);
    const bw = hubWindows('blue', 'red');
    expect(isActiveAt(40, bw)).toBe(true);
  });
  it('inactive FUEL scores 0 and is reported', () => {
    const s = scoreMatch({
      alliance: 'red', autoWinner: 'red', autoFuel: 6,
      cycles: [{ tScore: 40, fuel: 10, zone: 'close' }, { tScore: 60, fuel: 10, zone: 'close' }],
      accuracy: { close: 1, mid: 1, long: 1 }, jamLoss: 0,
      climb: { level: 0, period: 'NONE' },
    });
    expect(s.teleActive).toBeCloseTo(10, 5);
    expect(s.teleInactiveAttempted).toBeCloseTo(10, 5);
    expect(s.fuelPoints).toBeCloseTo(16, 5);
  });
  it('tower values: 15 AUTO L1, 10/20/30 TELEOP', () => {    const a = scoreMatch({ alliance: 'blue', autoWinner: 'blue', autoFuel: 0, cycles: [], accuracy: { close: 1, mid: 1, long: 1 }, jamLoss: 0, climb: { level: 1, period: 'AUTO' } });
    expect(a.towerPoints).toBe(15);
    const t = scoreMatch({ alliance: 'blue', autoWinner: 'blue', autoFuel: 0, cycles: [], accuracy: { close: 1, mid: 1, long: 1 }, jamLoss: 0, climb: { level: 3, period: 'TELEOP' } });
    expect(t.towerPoints).toBe(30);
  });
});

describe('strategy + monte carlo', () => {
  it('generates timeline for every archetype preset', () => {
    const robots = (archetypes as any).archetypes;
    for (const rb of robots) {
      const p = planStrategy(rb, { id: 'x', phase: 'TELEOP', name: 't', route: ['neutralCenter', 'hubScore'] }, { alliance: 'blue', autoWinner: 'red' });
      expect(p.cycles).toBeGreaterThan(0);
      expect(p.events.length).toBeGreaterThan(2);
    }
  });
  it('monte carlo is reproducible with seed', () => {
    const a = runMonteCarlo({ runs: 200, seed: 422, baseCycleSec: 12, cycles: 8, fuelPerCycle: 12, accuracy: 0.85, jamProb: 0.02, climbEV: 17 });
    const b = runMonteCarlo({ runs: 200, seed: 422, baseCycleSec: 12, cycles: 8, fuelPerCycle: 12, accuracy: 0.85, jamProb: 0.02, climbEV: 17 });
    expect(a.mean).toBeCloseTo(b.mean, 10);
    expect(a.p10).toBeLessThanOrEqual(a.p50);
    expect(a.p50).toBeLessThanOrEqual(a.p90);
    expect(mulberry32(7)()).not.toBe(mulberry32(8)());
  });
});

describe('deterministic shot/jam outcomes', () => {
  it('is stable for the same inputs', () => {
    expect(shotHit(3, 1, 0.8)).toBe(shotHit(3, 1, 0.8));
    expect(jamThisCycle(3, 1, 0.05)).toBe(jamThisCycle(3, 1, 0.05));
    expect(hash01(42)).toBeGreaterThanOrEqual(0);
    expect(hash01(42)).toBeLessThan(1);
  });
  it('perfect and zero accuracy are absolute', () => {
    expect(shotHit(0, 0, 1)).toBe(true);
    expect(shotHit(0, 0, 0)).toBe(false);
    expect(jamThisCycle(0, 0, 0)).toBe(false);
  });
  it('hit rate tracks accuracy over many cycles', () => {
    let hits = 0;
    for (let c = 0; c < 500; c++) if (shotHit(c, 0, 0.8)) hits++;
    expect(hits).toBeGreaterThan(340);
    expect(hits).toBeLessThan(460);
  });
});

describe('scenario portability', () => {
  it('round-trips scenario JSON', () => {
    const sc = { id: 't', robotId: 'allrounder', seed: 422, fieldVersion: 'rebuilt-2026 v1.0.0' };
    expect(JSON.parse(JSON.stringify(sc)).robotId).toBe('allrounder');
  });
});
