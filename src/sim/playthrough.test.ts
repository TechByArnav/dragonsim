import { describe, it, expect } from 'vitest';
import { buildPlaythrough, MATCH_LEN, MIN_STEP_IN } from './playthrough';
import { colliderRects } from './nav';
import { hubWindows, isActiveAt } from './scoring';
import archetypes from '../../data/robots/archetypes.json';

const robots = (archetypes as any).archetypes;
const sprinter = robots.find((r: any) => r.id === 'sprinter');
const allrounder = robots.find((r: any) => r.id === 'allrounder');

function opts(o: Record<string, unknown> = {}) {
  return {
    robot: sprinter,
    routeSeq: ['neutralCenter', 'hubScore'],
    alliance: 'blue' as const,
    autoWinner: 'red' as const,
    zone: 'close' as const,
    climbLevel: 2 as const,
    endgameId: 'end-early',
    congestion: 0.6,
    defense: 0,
    origin: { x: -230, y: -20 },
    gridIn: 8,
    slot: 0,
    role: 'scorer',
    ...o,
  };
}

describe('playthrough builder invariants', () => {
  it('clock is strictly increasing and spans the full match', () => {
    const r = buildPlaythrough(opts());
    for (let i = 1; i < r.path.length; i++) {
      expect(r.path[i].t).toBeGreaterThan(r.path[i - 1].t);
    }
    expect(r.path[r.path.length - 1].t).toBeGreaterThanOrEqual(MATCH_LEN - 1);
    expect(r.path[0].t).toBe(0);
  });

  it('never dithers: distinct consecutive points respect MIN_STEP', () => {
    for (const slot of [0, 1, 2]) {
      const r = buildPlaythrough(opts({ slot }));
      for (let i = 1; i < r.path.length; i++) {
        const d = Math.hypot(r.path[i].x - r.path[i - 1].x, r.path[i].y - r.path[i - 1].y);
        if (d > 0.01) expect(d).toBeGreaterThanOrEqual(MIN_STEP_IN - 0.1);
      }
    }
  });

  it('never penetrates colliders, either alliance, every slot', () => {
    for (const alliance of ['blue', 'red'] as const) {
      for (let slot = 0; slot < 3; slot++) {
        const r = buildPlaythrough(opts({ alliance, slot, origin: alliance === 'blue' ? { x: -230, y: -20 } : { x: 230, y: 20 } }));
        for (const p of r.path) {
          for (const o of colliderRects()) {
            const inX = Math.abs(p.x - o.cx) < o.hx + 4;
            const inY = Math.abs(p.y - o.cy) < o.hy + 4;
            expect(inX && inY).toBe(false);
          }
        }
      }
    }
  });

  it('slots aim at separated patches (no stacking)', () => {
    const a = buildPlaythrough(opts({ slot: 0 }));
    const b = buildPlaythrough(opts({ slot: 1 }));
    const teleShotsA = a.shots.filter((s) => s.t >= 20);
    const teleShotsB = b.shots.filter((s) => s.t >= 20);
    expect(teleShotsA.length).toBeGreaterThan(0);
    expect(teleShotsB.length).toBeGreaterThan(0);
    const d = Math.hypot(teleShotsA[0].x - teleShotsB[0].x, teleShotsA[0].y - teleShotsB[0].y);
    expect(d).toBeGreaterThanOrEqual(15);
  });

  it('runs a full program: 3+ TELEOP scores, shots only while active', () => {
    const r = buildPlaythrough(opts({ robot: allrounder }));
    const tele = r.shots.filter((s) => s.t >= 20);
    expect(tele.length).toBeGreaterThanOrEqual(3);
    const w = hubWindows('blue', 'red');
    for (const s of r.shots) {
      if (s.t >= 20) expect(isActiveAt(s.t, w)).toBe(true);
    }
  });

  it('is deterministic across rebuilds', () => {
    const a = buildPlaythrough(opts());
    const b = buildPlaythrough(opts());
    expect(a.shots).toEqual(b.shots);
    expect(a.path.length).toBe(b.path.length);
  });
});
