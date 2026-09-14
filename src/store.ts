import { create } from 'zustand';
import archetypes from '../data/robots/archetypes.json';
import presets from '../data/strategies/presets.json';

export type View = 'home' | 'field' | 'robots' | 'strategies' | 'simulate' | 'analytics' | 'context' | 'saved' | 'settings' | 'docs';
export interface RobotCfg { id: string; [k: string]: unknown }
export interface AppState {
  view: View;
  alliance: 'red' | 'blue';
  autoWinner: 'red' | 'blue' | 'tie';
  robotId: string;
  robotOverrides: Record<string, number | string>;
  strategyId: string;
  teleStrategyId: string;
  endgameId: string;
  origin: { x: number; y: number };
  dest: { x: number; y: number } | null;
  units: 'imperial' | 'metric';
  debug: boolean;
  labels: boolean;
  heatmap: boolean;
  heatMode: string;
  gridIn: number;
  congestion: number;
  defense: number;
  climbLevel: 0 | 1 | 2 | 3;
  zone: 'close' | 'mid' | 'long';
  mcRuns: number;
  seed: number;
  glbUrl: string | null;
  compareId: string | null;
  simpleMode: boolean;
  quality: 'low' | 'balanced' | 'high';
  allianceMode: boolean;
  allianceRobots: [string, string, string];
  allianceRoles: [string, string, string];
  docsPage: string;
  set: (p: Partial<AppState>) => void;
  robot: () => any;
}

export const useApp = create<AppState>((set, get) => ({
  view: 'home',
  alliance: 'blue',
  autoWinner: 'red',
  robotId: 'allrounder',
  robotOverrides: {},
  strategyId: 'auto-preload',
  teleStrategyId: 'tele-neutral',
  endgameId: 'end-early',
  origin: { x: -230, y: -20 },
  dest: { x: -110, y: 20 },
  units: 'imperial',
  debug: false,
  labels: true,
  heatmap: false,
  heatMode: 'realistic',
  gridIn: 8,
  congestion: 0.6,
  defense: 0,
  climbLevel: 2,
  zone: 'close',
  mcRuns: 500,
  seed: 422,
  glbUrl: null,
  compareId: null,
  simpleMode: true,
  quality: 'balanced',
  allianceMode: true,
  allianceRobots: ['allrounder', 'sprinter', 'climber'],
  allianceRoles: ['scorer', 'support', 'climb'],
  docsPage: 'guide',
  set: (p) => set(p),
  robot: () => {
    const base = (archetypes as any).archetypes.find((r: any) => r.id === get().robotId) ?? (archetypes as any).archetypes[1];
    return { ...base, ...get().robotOverrides };
  },
}));

export const allRobots = () => (archetypes as any).archetypes as any[];
export const allStrategies = () => (presets as any).presets as any[];
