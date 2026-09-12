import { describe, it, expect } from 'vitest';
import { trapezoidTime, estimateSegment } from './motion';
import { astar, fieldGridFromConstants } from './nav';
import { scoreMatch, hubWindows, isActiveAt } from './scoring';
import { planStrategy } from './strategy';
import { runMonteCarlo, mulberry32 } from './montecarlo';
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
  it('tower values: 15 AUTO L1, 10/20/30 TELEOP', () => {
    const a = scoreMatch({ alliance: 'blue', autoWinner: 'blue', autoFuel: 0, cycles: [], accuracy: { close: 1, mid: 1, long: 1 }, jamLoss: 0, climb: { level: 1, period: 'AUTO' } });
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

describe('scenario portability', () => {
  it('round-trips scenario JSON', () => {
    const sc = { id: 't', robotId: 'allrounder', seed: 422, fieldVersion: 'rebuilt-2026 v1.0.0' };
    expect(JSON.parse(JSON.stringify(sc)).robotId).toBe('allrounder');
  });
});
