import { describe, it, expect } from 'vitest';
import { inToCm, mToIn, inToM } from '../lib/units';
import field from '../../data/field/rebuilt-2026.field.json';
import rules from '../../data/rules/rebuilt-2026.rules.json';

describe('units', () => {
  it('converts inches<->metric', () => {
    expect(inToCm(1)).toBeCloseTo(2.54, 6);
    expect(inToM(39.37007874)).toBeCloseTo(1, 4);
    expect(mToIn(1)).toBeCloseTo(39.37, 2);
  });
});

describe('field schema', () => {
  it('has footprint + hubs + required elements', () => {
    expect((field as any).footprint.lengthIn).toBeCloseTo(651.2, 0);
    expect((field as any).footprint.widthIn).toBeCloseTo(317.7, 0);
    expect((field as any).elements.hubs.length).toBe(2);
    expect((field as any).elements.bumps.length).toBe(4);
    expect((field as any).elements.trenches.length).toBe(4);
    expect((field as any).starts.length).toBe(6);
  });
  it('flags estimated placements', () => {
    const bumps = (field as any).elements.bumps;
    expect(bumps.every((b: any) => b.source)).toBe(true);
  });
});

describe('rules schema', () => {
  it(' Encodes TU22 scoring defaults', () => {
    expect((rules as any).points.fuelActiveAuto).toBe(1);
    expect((rules as any).points.fuelActiveTeleop).toBe(1);
    expect((rules as any).points.towerAutoL1).toBe(15);
    expect((rules as any).points.towerTeleop.L3).toBe(30);
    expect((rules as any).rankingPoints.thresholds.energized).toBe(100);
    expect((rules as any).rankingPoints.thresholds.supercharged).toBe(360);
  });
});
