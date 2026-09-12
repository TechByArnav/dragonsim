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

// Simplified rail: 5 primary actions + library group. Advanced pages still reachable.
const RAIL_MAIN: { id: any; label: string; hint: string }[] = [
  { id: 'simulate', label: '▶ Simulate', hint: '3D + score' },
  { id: 'robots', label: '🤖 Robot', hint: 'pick + tune' },
  { id: 'strategies', label: '🗺 Strategy', hint: 'pick plan' },
  { id: 'analytics', label: '📊 Results', hint: 'charts + export' },
  { id: 'field', label: '🏟 Field', hint: 'explore 3D' },
];
const RAIL_MORE: { id: any; label: string }[] = [
  { id: 'context', label: 'Library' },
  { id: 'saved', label: 'Saved' },
  { id: 'settings', label: 'Settings' },
];

const DEST_PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Neutral pile', x: 0, y: 0 },
  { label: 'My HUB', x: -110, y: 20 },
  { label: 'Depot', x: -280, y: 100 },
  { label: 'Outpost', x: -270, y: -120 },
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

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-dragon-950">
        <button onClick={() => s.set({ view: 'home' })} className="flex items-center gap-2">
          <img src="./dragon.svg" className="w-7 h-7" alt="home" />
          <span className="font-display font-bold text-lg">DragonSim</span>
        </button>
        <span className="text-xs text-zinc-400 hidden md:inline">Team 422 Shenron · REBUILT</span>
        <span className="ml-auto" />
        <label className="text-xs flex items-center gap-1">Alliance
          <select value={s.alliance} onChange={(e) => s.set({ alliance: e.target.value as any })}>
            <option value="blue">Blue</option><option value="red">Red</option>
          </select>
        </label>
        <button
          onClick={() => s.set({ simpleMode: !s.simpleMode })}
          title="Simple hides advanced sliders; Advanced shows everything"
          className={`text-xs px-3 py-1.5 rounded-lg font-display font-bold border ${s.simpleMode ? 'bg-dragon-500 text-dragon-950 border-dragon-500' : 'border-white/20 text-zinc-200'}`}
        >
          {s.simpleMode ? 'Simple ✓' : 'Advanced'}
        </button>
      </header>
      <div className="flex-1 flex min-h-0">
        <nav className="w-36 shrink-0 border-r border-white/10 p-2 space-y-1 bg-black/30">
          {RAIL_MAIN.map((r) => (
            <button key={r.id} onClick={() => s.set({ view: r.id })}
              className={`w-full text-left px-3 py-2 rounded-lg ${s.view === r.id ? 'bg-dragon-500/20 border border-dragon-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
              <div className="font-display font-bold text-sm">{r.label}</div>
              <div className="text-[11px] text-zinc-500">{r.hint}</div>
            </button>
          ))}
          <div className="label px-2 pt-2">More</div>
          {RAIL_MORE.map((r) => (
            <button key={r.id} onClick={() => s.set({ view: r.id })}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs ${s.view === r.id ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent text-zinc-300'}`}>
              {r.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 flex flex-col min-w-0">
          {(s.view === 'field' || s.view === 'simulate') && (
            <>
              <SimpleToolbar />
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 min-w-0" style={{ minHeight: 420 }}>
                  <FieldScene measure={{ a: null, b: null }} />
                </div>
                <aside className="w-[340px] shrink-0 border-l border-white/10 p-3 space-y-3 overflow-y-auto bg-black/20">
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

// Only destination presets in simple mode; numbers + heat + measure live in Advanced.
function SimpleToolbar() {
  const s = useApp();
  return (
    <div className="flex gap-2 px-3 py-2 text-xs border-b border-white/10 flex-wrap items-center">
      <span className="text-zinc-400">👆 Click field to move robot · Drive to:</span>
      {DEST_PRESETS.map((d) => {
        const mineHub = s.alliance === 'blue' ? { x: -110, y: 20 } : { x: 110, y: -20 };
        const pos = d.label === 'My HUB' ? mineHub : { x: d.x, y: d.y };
        const active = s.dest && Math.abs(s.dest.x - pos.x) < 4 && Math.abs(s.dest.y - pos.y) < 4;
        return (
          <button key={d.label} onClick={() => s.set({ dest: pos })}
            className={`px-3 py-1.5 rounded-lg border font-semibold ${active ? 'bg-dragon-500 text-dragon-950 border-dragon-500' : 'border-white/15 hover:border-dragon-500/60'}`}>
            {d.label}
          </button>
        );
      })}
      {!s.simpleMode && <AdvancedToolbar />}
    </div>
  );
}

function AdvancedToolbar() {
  const s = useApp();
  const [measure, setMeasure] = useState(false);
  return (
    <>
      <label className="panel px-2 py-1">Dest X<input type="number" value={s.dest?.x ?? 0} onChange={(e) => s.set({ dest: { x: +e.target.value, y: s.dest?.y ?? 0 } })} className="w-20 ml-1" /></label>
      <label className="panel px-2 py-1">Dest Y<input type="number" value={s.dest?.y ?? 0} onChange={(e) => s.set({ dest: { x: s.dest?.x ?? 0, y: +e.target.value } })} className="w-20 ml-1" /></label>
      <button className="btn-ghost !py-1" onClick={() => setMeasure(!measure)}>📏 Measure {measure ? 'on' : 'off'}</button>
      <label className="flex items-center gap-1"><input type="checkbox" checked={s.heatmap} onChange={(e) => s.set({ heatmap: e.target.checked })} /> Heatmap</label>
      <label>Heat<select value={s.heatMode} onChange={(e) => s.set({ heatMode: e.target.value })} className="ml-1">
        <option value="theoretical">theoretical</option><option value="realistic">realistic</option>
        <option value="congested">congested</option><option value="defended">defended</option>
      </select></label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={s.debug} onChange={(e) => s.set({ debug: e.target.checked })} /> Debug</label>
      <label>Units<select value={s.units} onChange={(e) => s.set({ units: e.target.value as any })} className="ml-1">
        <option value="imperial">in</option><option value="metric">metric</option>
      </select></label>
    </>
  );
}

function RightPanel({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  return (
    <div className="space-y-3 text-sm">
      {/* Step 1 */}
      <div className="kpi">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold">1 · Robots</div>
          <button onClick={() => s.set({ allianceMode: !s.allianceMode })}
            className={`text-[11px] px-2 py-1 rounded-full border font-bold ${s.allianceMode ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984]'}`}>
            {s.allianceMode ? '3-robot alliance ON' : 'Single robot'}
          </button>
        </div>
        {!s.allianceMode ? (
          <>
            <select value={s.robotId} onChange={(e) => s.set({ robotId: e.target.value })} className="w-full mt-1 text-base py-1.5">
              {allRobots().map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <div className="text-xs text-zinc-400 mt-1">{sim.robot.desc}</div>
          </>
        ) : (
          <AllianceEditors />
        )}
      </div>
      {/* Step 2 */}
      <div className="kpi">
        <div className="font-display font-bold">2 · Plan</div>
        <select value={s.teleStrategyId} onChange={(e) => s.set({ teleStrategyId: e.target.value })} className="w-full mt-1 text-base py-1.5">
          {allStrategies().filter((x: any) => x.phase === 'TELEOP').map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1 mt-2">
          {(['close', 'mid', 'long'] as const).map((z) => (
            <button key={z} onClick={() => s.set({ zone: z })}
              className={`py-1.5 rounded-lg border text-xs font-bold ${s.zone === z ? 'bg-dragon-500 text-dragon-950 border-dragon-500' : 'border-white/15'}`}>{z}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1">
          {([0, 1, 2, 3] as const).map((lv) => (
            <button key={lv} onClick={() => s.set({ climbLevel: lv })}
              className={`py-1.5 rounded-lg border text-xs font-bold ${s.climbLevel === lv ? 'bg-gold text-black border-gold' : 'border-white/15'}`}>
              {lv === 0 ? 'No climb' : `L${lv}`}
            </button>
          ))}
        </div>
        {!s.simpleMode && <SimControls />}
      </div>
      {/* Step 3 */}
      <div className="kpi">
        <div className="font-display font-bold">3 · Score <span className="text-[11px] font-body font-normal text-zinc-400">(estimate, not a guarantee)</span></div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div className="panel p-2"><div className="label">Low</div><div className="font-display text-2xl font-bold">{sim.cons.toFixed(0)}</div></div>
          <div className="panel p-2 border-dragon-500/50"><div className="label">Expected</div><div className="font-display text-3xl font-bold text-dragon-500">{sim.scored.total.toFixed(0)}</div><div className="text-[11px]">fuel {sim.scored.fuelPoints.toFixed(0)} + climb {sim.scored.towerPoints}</div></div>
          <div className="panel p-2"><div className="label">High</div><div className="font-display text-2xl font-bold">{sim.best.toFixed(0)}</div></div>
        </div>
        <div className="text-xs text-zinc-300 mt-2">
          🚗 Drive there in <b>~{sim.seg ? sim.seg.realisticSec.toFixed(1) : '—'}s</b>
          {sim.route ? ` (${sim.route.distanceIn.toFixed(0)} in)` : ''} · 🔁 {sim.plan.cycles} cycles × ~{sim.avgCycle.toFixed(0)}s
        </div>
        {sim.scored.teleInactiveAttempted > 0.5 && (
          <div className="text-xs text-amber-200 mt-1">⏳ {sim.scored.teleInactiveAttempted.toFixed(0)} FUEL arrived while HUB was off (0 pts) — try a different AUTO winner or depot timing.</div>
        )}
        <button onClick={() => s.set({ view: 'analytics' })} className="btn-primary w-full mt-2">See charts + export →</button>
        <AllianceTotal sim={sim} />
        {!s.simpleMode && <Assumptions sim={sim} />}
      </div>
    </div>
  );
}

function AllianceEditors() {
  const s = useApp();
  const colors = ['#7fee64', '#22d3ee', '#f5c518'];
  return (
    <div className="space-y-1.5 mt-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-1 items-center text-xs">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colors[i] }} />
          <select value={s.allianceRobots[i]} onChange={(e) => {
            const n = [...s.allianceRobots] as [string, string, string];
            n[i] = e.target.value; s.set({ allianceRobots: n, robotId: i === 0 ? e.target.value : s.robotId });
          }} className="flex-1 py-1">
            {allRobots().map((x: any) => <option key={x.id} value={x.id}>R{i + 1} {x.name}</option>)}
          </select>
          <select value={s.allianceRoles[i]} onChange={(e) => {
            const n = [...s.allianceRoles] as [string, string, string];
            n[i] = e.target.value; s.set({ allianceRoles: n });
          }} className="w-24 py-1">
            <option value="scorer">scorer</option>
            <option value="support">support</option>
            <option value="climb">climb</option>
            <option value="defense">defense</option>
          </select>
        </div>
      ))}
      <div className="text-[11px] text-zinc-500">R1 drives the playthrough trail; R2/R3 run offset lanes. Combined score below = simplified shared-HUB model.</div>
    </div>
  );
}

function AllianceTotal({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  if (!s.allianceMode) return null;
  // Simplified combined model: R1 full sim + role-weighted partners - shared congestion.
  // Labeled simplified, not a match predictor.
  const w = s.allianceRoles.map((r) => (r === 'scorer' ? 0.85 : r === 'support' ? 0.45 : r === 'climb' ? 0.3 : 0.15));
  const combined = sim.scored.total * (1 + w[1] + w[2]) - 6; // -6 shared-HUB congestion
  return (
    <div className="panel p-2 mt-2 text-xs">
      <div className="font-display font-bold">Alliance (3 robots, simplified)</div>
      <div className="flex gap-1 mt-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="px-2 py-0.5 rounded-full font-mono font-bold text-black"
            style={{ background: ['#7fee64', '#22d3ee', '#f5c518'][i] }}>
            R{i + 1} {i === 0 ? sim.scored.total.toFixed(0) : `~${(sim.scored.total * w[i]).toFixed(0)}`}
          </span>
        ))}
        <span className="font-mono ml-auto">≈ <b>{Math.max(0, combined).toFixed(0)} pts</b></span>
      </div>
      <div className="text-zinc-500 mt-1">Match the pill colors to the robots + trails on the field. Shared HUB congestion penalized. Tune roles above.</div>
    </div>
  );
}
function Assumptions({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  return (
    <details className="text-xs text-zinc-400 mt-2">
      <summary className="cursor-pointer">Assumptions + route math</summary>
      <div className="mt-1">Trapezoidal + A* grid {s.gridIn}in, congestion +{s.congestion}s, defense +{s.defense}s. HUB gating Table 6-3, RP 100/360/50.</div>
      {sim.seg?.assumptions.map((a, i) => <div key={i}>· {a}</div>)}
      <div className="text-amber-200/80">Needs verification: element XY, R107 vertical limit, AndyMark delta (Chesapeake = AndyMark).</div>
    </details>
  );
}

function SimControls() {
  const s = useApp();
  return (
    <div className="text-xs space-y-2 mt-2 border-t border-white/10 pt-2">
      <div className="label">Fine-tuning (advanced)</div>
      <label className="flex justify-between">AUTO winner
        <select value={s.autoWinner} onChange={(e) => s.set({ autoWinner: e.target.value as any })}>
          <option value="red">Red scores more</option><option value="blue">Blue scores more</option><option value="tie">Tie (random)</option>
        </select>
      </label>
      <label>Traffic +{s.congestion.toFixed(1)}s <input type="range" min={0} max={4} step={0.1} value={s.congestion} onChange={(e) => s.set({ congestion: +e.target.value })} /></label>
      <label>Defense +{s.defense.toFixed(1)}s <input type="range" min={0} max={6} step={0.1} value={s.defense} onChange={(e) => s.set({ defense: +e.target.value })} /></label>
      <label>Endgame
        <select value={s.endgameId} onChange={(e) => s.set({ endgameId: e.target.value })}>
          <option value="end-early">Climb early</option><option value="end-late">Last cycle + climb</option><option value="end-skip">Skip climb</option>
        </select>
      </label>
    </div>
  );
}

function BottomTimeline({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  const segs = [
    { id: 'AUTO', w: 20 }, { id: 'TRANS', w: 10 }, { id: 'S1', w: 25 },
    { id: 'S2', w: 25 }, { id: 'S3', w: 25 }, { id: 'S4', w: 25 }, { id: 'END', w: 30 },
  ];
  const total = 160;
  return (
    <div className="border-t border-white/10 px-3 py-2 bg-black/30">
      <div className="flex h-6 rounded overflow-hidden border border-white/10 text-[10px] font-mono">
        {segs.map((g) => (
          <div key={g.id} style={{ width: `${(100 * g.w) / total}%` }} className="border-r border-white/10 bg-dragon-800/60 flex items-center justify-center truncate px-1" title={g.id}>{g.id}</div>
        ))}
      </div>
      <div className="text-xs text-zinc-300 mt-1">
        {sim.plan.cycles} cycles · {sim.scored.total.toFixed(0)} pts expected · climb {s.climbLevel === 0 ? 'skipped' : `L${s.climbLevel}`} · {s.alliance} HUB {s.alliance === s.autoWinner ? 'off' : 'ON'} in S1
        {!s.simpleMode && <span className="font-mono text-[11px] text-zinc-400"> · {sim.plan.events.slice(0, 6).map((e) => `t+${e.t.toFixed(0)}s ${e.kind}`).join(' · ')}…</span>}
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
          <div className="font-display font-bold text-lg">{ph === 'AUTO' ? 'Start (AUTO)' : ph === 'TELEOP' ? 'Main plan' : 'Finish (endgame)'}</div>
          {list.filter((x: any) => x.phase === ph).map((x: any) => {
            const active = (ph === 'AUTO' ? s.strategyId : ph === 'TELEOP' ? s.teleStrategyId : s.endgameId) === x.id;
            return (
              <button key={x.id} onClick={() => s.set(ph === 'AUTO' ? { strategyId: x.id } : ph === 'TELEOP' ? { teleStrategyId: x.id } : { endgameId: x.id })}
                className={`block w-full text-left mt-2 p-3 rounded-xl border ${active ? 'border-dragon-500 bg-dragon-500/10' : 'border-white/10 hover:border-white/30'}`}>
                <div className="font-bold">{active ? '✓ ' : ''}{x.name}</div>
                <div className="text-zinc-400 text-xs mt-0.5">{x.purpose}</div>
                {!s.simpleMode && <div className="font-mono text-[11px] mt-1 text-zinc-500">route: {x.route.join(' → ')} · poor when: {x.poorWhen}</div>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
