import { useMemo, useState } from 'react';
import { useApp, allRobots, allStrategies } from '../store';
import { FieldScene } from '../three/FieldScene';
import { astar, fieldGridFromConstants } from '../sim/nav';
import { estimateSegment } from '../sim/motion';
import { planStrategy } from '../sim/strategy';
import { scoreMatch } from '../sim/scoring';
import { runMonteCarlo } from '../sim/montecarlo';
import { RobotsView } from './RobotsView';
import { AnalyticsView } from './AnalyticsView';
import { ContextView } from './ContextView';
import { SavedView, SettingsView } from './SavedSettings';

const RAIL: { id: any; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'field', label: 'Field' }, { id: 'robots', label: 'Robots' },
  { id: 'strategies', label: 'Strategies' }, { id: 'simulate', label: 'Simulate' }, { id: 'analytics', label: 'Analytics' },
  { id: 'context', label: 'Context Library' }, { id: 'saved', label: 'Saved Scenarios' }, { id: 'settings', label: 'Settings' },
];

export function useSim() {
  const s = useApp();
  return useMemo(() => {
    const robot = s.robot();
    const grid = fieldGridFromConstants(s.gridIn, Math.max(robot.footprintIn.x, robot.footprintIn.y));
    const route = s.dest ? astar(s.origin, s.dest, grid) : null;
    const seg = route?.reachable
      ? estimateSegment(route.distanceIn, 40, {
          vmaxInPerSec: robot.vmaxInPerSec, amaxInPerSec2: robot.amaxInPerSec2, brakeInPerSec2: robot.brakeInPerSec2,
          omegaDegPerSec: robot.omegaDegPerSec, turnAccelDegPerSec2: robot.turnAccelDegPerSec2,
          batteryDerate: robot.batteryDerate, congestionSec: s.congestion, defenseSec: s.defense,
          driverNoise: 0.06, curvatureFactor: 0.12 + (1 - robot.maneuver) * 0.15,
        })
      : null;
    const tele = allStrategies().find((x: any) => x.id === s.teleStrategyId) ?? allStrategies()[4];
    const plan = planStrategy(robot, tele, {
      alliance: s.alliance, autoWinner: s.autoWinner, teleopBudgetSec: 140,
      endgameCutoffSec: s.endgameId === 'end-skip' ? 0 : s.endgameId === 'end-late' ? 12 : 30,
      congestionSec: s.congestion, defenseSec: s.defense, zone: s.zone, climbLevel: s.climbLevel,
    });
    const autoFuel = Math.round(8 * (robot.accuracy?.close ?? 0.85));
    const scored = scoreMatch({
      alliance: s.alliance, autoWinner: s.autoWinner, autoFuel,
      cycles: plan.scoreAttempts, accuracy: robot.accuracy, jamLoss: Math.round(plan.cycles * robot.jamProb * robot.storage * 0.5),
      climb: s.climbLevel === 0 ? { level: 0, period: 'NONE' } : { level: s.climbLevel as 1 | 2 | 3, period: 'TELEOP' },
    });
    const avgCycle = plan.cycles ? (plan.collectSec + plan.travelSec + plan.scoreSec) / plan.cycles : 0;
    const mc = runMonteCarlo({
      runs: Math.min(2000, s.mcRuns), seed: s.seed, baseCycleSec: Math.max(avgCycle, 4),
      cycles: Math.max(plan.cycles, 1), fuelPerCycle: plan.cycles ? plan.fuelCarried / plan.cycles : 8,
      accuracy: robot.accuracy?.[s.zone] ?? 0.8, jamProb: robot.jamProb,
      climbEV: s.climbLevel === 0 ? 0 : [0, 10, 20, 30][s.climbLevel] * (robot.climb?.pSuccess ?? 0.8),
    });
    const best = scored.total * 1.12, cons = scored.total * 0.82;
    return { robot, route, seg, plan, scored, autoFuel, avgCycle, mc, best, cons, tele };
  }, [s.robotId, s.robotOverrides, s.origin, s.dest, s.gridIn, s.congestion, s.defense, s.teleStrategyId, s.alliance, s.autoWinner, s.zone, s.climbLevel, s.endgameId, s.mcRuns, s.seed]);
}

export function Workspace() {
  const s = useApp();
  const sim = useSim();
  const [measureMode, setMeasureMode] = useState(false);
  const [mA, setMA] = useState<{ x: number; y: number } | null>(null);
  const [mB, setMB] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-dragon-950">
        <button onClick={() => s.set({ view: 'home' })} className="flex items-center gap-2">
          <img src="./dragon.svg" className="w-7 h-7" alt="home" />
          <span className="font-display font-bold text-lg">DragonSim</span>
        </button>
        <span className="text-xs text-zinc-400">Team 422 Shenron · field v1.0.0 · rules TU22 · inches</span>
        <span className="ml-auto" />
        <label className="text-xs flex items-center gap-1">Alliance
          <select value={s.alliance} onChange={(e) => s.set({ alliance: e.target.value as any })}>
            <option value="blue">Blue</option><option value="red">Red</option>
          </select>
        </label>
        <label className="text-xs flex items-center gap-1">Units
          <select value={s.units} onChange={(e) => s.set({ units: e.target.value as any })}>
            <option value="imperial">in</option><option value="metric">metric</option>
          </select>
        </label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={s.debug} onChange={(e) => s.set({ debug: e.target.checked })} /> Debug</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={s.heatmap} onChange={(e) => s.set({ heatmap: e.target.checked })} /> Heatmap</label>
      </header>
      <div className="flex-1 flex min-h-0">
        <nav className="w-40 shrink-0 border-r border-white/10 p-2 space-y-1 bg-black/30">
          {RAIL.map((r) => (
            <button key={r.id} onClick={() => s.set({ view: r.id })}
              className={`w-full text-left px-3 py-2 rounded-lg font-display font-semibold text-sm ${s.view === r.id ? 'bg-dragon-500/20 border border-dragon-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
              {r.label}
            </button>
          ))}
          <div className="text-[11px] text-zinc-500 px-2 pt-3">Single-robot v1.<br />Alliance planner deferred.</div>
        </nav>
        <div className="flex-1 flex flex-col min-w-0">
          {(s.view === 'field' || s.view === 'simulate') && (
            <>
              <div className="flex gap-2 px-3 py-2 text-xs border-b border-white/10 flex-wrap">
                <span className="panel px-2 py-1">Click field = move origin · Set dest below</span>
                <label>Dest X<input type="number" value={s.dest?.x ?? -120} onChange={(e) => s.set({ dest: { x: +e.target.value, y: s.dest?.y ?? 0 } })} className="w-20 ml-1" /></label>
                <label>Dest Y<input type="number" value={s.dest?.y ?? 0} onChange={(e) => s.set({ dest: { x: s.dest?.x ?? -120, y: +e.target.value } })} className="w-20 ml-1" /></label>
                <button className="btn-ghost !py-1" onClick={() => { setMeasureMode(!measureMode); setMA(s.origin); setMB(s.dest); }}>📏 Measure</button>
                <label>Heat
                  <select value={s.heatMode} onChange={(e) => s.set({ heatMode: e.target.value })} className="ml-1">
                    <option value="theoretical">theoretical</option><option value="realistic">realistic</option>
                    <option value="congested">congested</option><option value="defended">defended</option>
                    <option value="return-hub">return-to-HUB</option><option value="to-fuel">time-to-FUEL</option>
                  </select>
                </label>
                <label>Grid<input type="number" value={s.gridIn} min={4} max={16} step={1} onChange={(e) => s.set({ gridIn: +e.target.value })} className="w-14 ml-1" /> in</label>
                {measureMode && <span className="text-gold">Measure: origin→dest distance shown in viewport (editable dest).</span>}
              </div>
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 min-w-0" style={{ minHeight: 420 }}>
                  <FieldScene measure={{ a: measureMode ? mA : null, b: measureMode ? mB : null }} />
                </div>
                <aside className="w-80 shrink-0 border-l border-white/10 p-3 space-y-3 overflow-y-auto bg-black/20">
                  <RightPanel sim={sim} />
                </aside>
              </div>
              <BottomTimeline sim={sim} />
            </>
          )}
          {s.view === 'robots' && <RobotsView />}
          {s.view === 'strategies' && <StrategiesPanel />}
          {s.view === 'analytics' && <AnalyticsView sim={sim} />}
          {s.view === 'context' && <ContextView />}
          {s.view === 'saved' && <SavedView sim={sim} />}
          {s.view === 'settings' && <SettingsView />}
          {s.view === 'home' && <div className="p-6 text-sm">Use Home in rail to return.</div>}
        </div>
      </div>
    </div>
  );
}

function RightPanel({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  const r = sim.robot;
  const u = (inch: number) => (s.units === 'metric' ? `${(inch * 2.54).toFixed(1)} cm` : `${inch.toFixed(1)} in`);
  return (
    <div className="space-y-3 text-sm">
      <div className="kpi">
        <div className="label">Selected robot (single-team)</div>
        <select value={s.robotId} onChange={(e) => s.set({ robotId: e.target.value })} className="w-full mt-1">
          {allRobots().map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="mt-1 text-xs text-zinc-400">{r.desc}</div>
        <div className="grid grid-cols-2 gap-1 mt-2 font-mono text-xs">
          <div>vmax {r.vmaxInPerSec} in/s</div><div>storage {r.storage}</div>
          <div>acc {s.zone} {Math.round((r.accuracy?.[s.zone] ?? 0) * 100)}%</div><div>climb L{(r.climb?.levels ?? []).join('/') || '—'}</div>
        </div>
      </div>
      <div className="kpi">
        <div className="label">Active strategy</div>
        <div className="font-display font-bold">{sim.tele.name}</div>
        <div className="text-xs text-zinc-400">AUTO winner: {s.autoWinner} → {s.alliance} HUB {hubStateNote(s.alliance, s.autoWinner)}</div>
      </div>
      <div className="kpi">
        <div className="label">Current route (origin → dest)</div>
        {sim.route?.reachable && sim.seg ? (
          <div className="font-mono text-xs mt-1">
            <div>distance {u(sim.route.distanceIn)}</div>
            <div>best {sim.seg.bestSec.toFixed(1)}s · <b>expected {sim.seg.realisticSec.toFixed(1)}s</b> · conservative {sim.seg.conservativeSec.toFixed(1)}s</div>
            <details className="mt-1 text-zinc-400"><summary>Assumptions</summary>{sim.seg.assumptions.map((a, i) => <div key={i}>· {a}</div>)}</details>
          </div>
        ) : <div className="text-amber-300 text-xs mt-1">No valid route — {sim.route?.reason ?? 'set a destination'}. Invalid routes are never presented as legal.</div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="kpi"><div className="label">Expected</div><div className="font-display text-2xl font-bold text-dragon-500">{sim.scored.total.toFixed(0)}</div><div className="text-[11px]">pts (fuel {sim.scored.fuelPoints.toFixed(0)} + tower {sim.scored.towerPoints})</div></div>
        <div className="kpi"><div className="label">Best</div><div className="font-display text-2xl font-bold">{sim.best.toFixed(0)}</div><div className="text-[11px]">p90 {sim.mc.p90.toFixed(0)}</div></div>
        <div className="kpi"><div className="label">Conservative</div><div className="font-display text-2xl font-bold">{sim.cons.toFixed(0)}</div><div className="text-[11px]">p10 {sim.mc.p10.toFixed(0)}</div></div>
      </div>
      <div className="kpi text-xs">
        <div className="label">Cycle (estimated)</div>
        <div>{sim.plan.cycles} cycles · avg {sim.avgCycle.toFixed(1)}s · collect {sim.plan.collectSec.toFixed(0)}s · travel {sim.plan.travelSec.toFixed(0)}s · score {sim.plan.scoreSec.toFixed(0)}s</div>
        <div className="text-amber-200/90">Inactive-HUB hold: {sim.plan.lostInactiveSec.toFixed(1)}s · attempted-inactive scored 0 ({sim.scored.teleInactiveAttempted.toFixed(0)} FUEL)</div>
      </div>
      <div className="kpi text-xs">
        <div className="label">Assumptions ledger</div>
        <div>· Baseline engineering estimates — not measured Shenron facts</div>
        <div>· Trapezoidal motion + A* grid {s.gridIn}in + congestion {s.congestion}s + defense {s.defense}s</div>
        <div>· HUB gating per Table 6-3 · +3s ENDGAME tail · RP 100/360/50</div>
        <div className="text-amber-200/80">· Needs verification: BUMP/TRENCH/DEPOT/OUTPOST XY, R107 vertical limit vs climber, AndyMark-vs-welded delta (Chesapeake = AndyMark)</div>
      </div>
      <SimControls />
    </div>
  );
}

function hubStateNote(alliance: string, winner: string) {
  if (winner === 'tie') return 'tie → FMS random (modeled as red-first)';
  return alliance === winner ? 'inactive SHIFT1, then alternates' : 'ACTIVE SHIFT1, then alternates';
}

function SimControls() {
  const s = useApp();
  return (
    <div className="kpi text-xs space-y-2">
      <div className="label">Simulation run controls</div>
      <label className="flex justify-between">AUTO winner
        <select value={s.autoWinner} onChange={(e) => s.set({ autoWinner: e.target.value as any })}>
          <option value="red">Red scores more</option><option value="blue">Blue scores more</option><option value="tie">Tie (FMS random)</option>
        </select>
      </label>
      <label className="flex justify-between">Shoot zone
        <select value={s.zone} onChange={(e) => s.set({ zone: e.target.value as any })}>
          <option value="close">close</option><option value="mid">mid</option><option value="long">long</option>
        </select>
      </label>
      <label>Congestion +{s.congestion.toFixed(1)}s <input type="range" min={0} max={4} step={0.1} value={s.congestion} onChange={(e) => s.set({ congestion: +e.target.value })} /></label>
      <label>Defense +{s.defense.toFixed(1)}s <input type="range" min={0} max={6} step={0.1} value={s.defense} onChange={(e) => s.set({ defense: +e.target.value })} /></label>
      <label>Climb
        <select value={s.climbLevel} onChange={(e) => s.set({ climbLevel: +e.target.value as any })}>
          <option value={0}>skip</option><option value={1}>L1</option><option value={2}>L2</option><option value={3}>L3</option>
        </select>
      </label>
      <label>MC runs {s.mcRuns} <input type="range" min={100} max={2000} step={100} value={s.mcRuns} onChange={(e) => s.set({ mcRuns: +e.target.value })} /></label>
      <label className="flex justify-between">Seed<input type="number" value={s.seed} onChange={(e) => s.set({ seed: +e.target.value })} className="w-24" /></label>
    </div>
  );
}

function BottomTimeline({ sim }: { sim: ReturnType<typeof useSim> }) {
  const segs = [
    { id: 'AUTO 0:20', w: 20 }, { id: 'TRANS 2:20–2:10', w: 10 }, { id: 'S1 2:10–1:45', w: 25 },
    { id: 'S2 1:45–1:20', w: 25 }, { id: 'S3 1:20–0:55', w: 25 }, { id: 'S4 0:55–0:30', w: 25 }, { id: 'END 0:30–0:00', w: 30 },
  ];
  const total = 160;
  return (
    <div className="border-t border-white/10 px-3 py-2 bg-black/30">
      <div className="flex h-6 rounded overflow-hidden border border-white/10 text-[10px] font-mono">
        {segs.map((g) => (
          <div key={g.id} style={{ width: `${(100 * g.w) / total}%` }} className="border-r border-white/10 bg-dragon-800/60 flex items-center justify-center truncate px-1" title={g.id}>{g.id}</div>
        ))}
      </div>
      <div className="text-[11px] font-mono text-zinc-300 mt-1 max-h-16 overflow-y-auto">
        {sim.plan.events.slice(0, 14).map((e, i) => <span key={i} className="mr-3">t+{e.t.toFixed(0)}s [{e.kind}] {e.detail}</span>)}
        {sim.plan.events.length > 14 && <span>… +{sim.plan.events.length - 14} more · climb decision at ENDGAME cutoff · HUB context: {sim.tele.name}</span>}
      </div>
    </div>
  );
}

function StrategiesPanel() {
  const s = useApp();
  const list = allStrategies();
  const phases = ['AUTO', 'TELEOP', 'ENDGAME'];
  return (
    <div className="p-4 grid md:grid-cols-3 gap-3 overflow-y-auto">
      {phases.map((ph) => (
        <div key={ph} className="panel p-3">
          <div className="font-display font-bold">{ph}</div>
          {list.filter((x: any) => x.phase === ph).map((x: any) => (
            <button key={x.id} onClick={() => s.set(ph === 'AUTO' ? { strategyId: x.id } : ph === 'TELEOP' ? { teleStrategyId: x.id } : { endgameId: x.id })}
              className={`block w-full text-left mt-2 p-2 rounded border text-xs ${(ph === 'AUTO' ? s.strategyId : ph === 'TELEOP' ? s.teleStrategyId : s.endgameId) === x.id ? 'border-dragon-500 bg-dragon-500/10' : 'border-white/10 hover:border-white/30'}`}>
              <div className="font-bold">{x.name}</div>
              <div className="text-zinc-400">{x.purpose}</div>
              <div className="font-mono mt-1">route: {x.route.join(' → ')}</div>
              <div className="text-zinc-500">abandon: {x.abandon} · cutoff {x.cutoffSec}s · poor: {x.poorWhen}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
