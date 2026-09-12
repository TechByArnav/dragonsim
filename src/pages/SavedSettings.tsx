import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { saveScenario, listScenarios, exportJSON } from '../lib/persist';
import type { useSim } from './Workspace';

export function SavedView({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const refresh = () => listScenarios().then(setRows).catch(() => setRows([]));
  useEffect(() => { refresh(); }, []);
  const snapshot = () => ({
    id: `scenario-${Date.now()}`,
    team: '422-shenron',
    robotId: s.robotId, robot: s.robot(), overrides: s.robotOverrides,
    alliance: s.alliance, autoWinner: s.autoWinner, tele: s.teleStrategyId, endgame: s.endgameId,
    origin: s.origin, dest: s.dest, congestion: s.congestion, defense: s.defense, zone: s.zone,
    climb: s.climbLevel, seed: s.seed, mcRuns: s.mcRuns,
    result: { total: sim.scored.total, fuel: sim.scored.fuelPoints, tower: sim.scored.towerPoints, p10: sim.mc.p10, p50: sim.mc.p50, p90: sim.mc.p90 },
    fieldVersion: 'rebuilt-2026 v1.0.0', rulesVersion: 'TU22',
    savedAt: new Date().toISOString(),
  });
  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="panel p-3 text-sm flex gap-2 flex-wrap items-center">
        <button className="btn-primary" onClick={async () => { await saveScenario(snapshot()); refresh(); }}>Save current scenario locally</button>
        <button className="btn-ghost" onClick={() => exportJSON('dragonsim-scenario.json', snapshot())}>Export JSON</button>
        <label className="text-xs">Import JSON <input type="file" accept=".json" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const j = JSON.parse(await f.text());
          s.set({ robotId: j.robotId ?? 'allrounder', robotOverrides: j.overrides ?? {}, alliance: j.alliance ?? 'blue', teleStrategyId: j.tele ?? 'tele-neutral' });
        }} /></label>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="panel p-3 text-xs font-mono">
          {r.id} · {r.robotId} · {r.tele} · {r.alliance} · total {Number(r.result?.total ?? 0).toFixed(0)} (p50 {Number(r.result?.p50 ?? 0).toFixed(0)}) · {r.savedAt}
          <button className="btn-ghost ml-3 !py-0.5" onClick={() => s.set({ robotId: r.robotId, robotOverrides: r.overrides ?? {}, teleStrategyId: r.tele })}>Load</button>
        </div>
      ))}
      {rows.length === 0 && <div className="text-xs text-zinc-500">No saved scenarios yet (IndexedDB, local-only).</div>}
    </div>
  );
}

export function SettingsView() {
  const s = useApp();
  return (
    <div className="p-4 grid md:grid-cols-2 gap-4 overflow-y-auto text-sm">
      <div className="panel p-3 space-y-2">
        <div className="font-display font-bold">Advanced coefficients (editable)</div>
        <label className="block text-xs">Grid resolution (in)<input type="number" value={s.gridIn} min={4} max={16} onChange={(e) => s.set({ gridIn: +e.target.value })} className="ml-2 w-20" /></label>
        <label className="block text-xs">Labels<input type="checkbox" checked={s.labels} onChange={(e) => s.set({ labels: e.target.checked })} className="ml-2" /></label>
        <label className="block text-xs">Debug collision volumes<input type="checkbox" checked={s.debug} onChange={(e) => s.set({ debug: e.target.checked })} className="ml-2" /></label>
        <div className="text-[11px] text-zinc-500">Motion: trapezoidal + turn + curvature + traction + congestion + defense + driver noise; conservative = realistic×1.18+0.25s. Heatmaps computed locally (coarse default for student laptops).</div>
      </div>
      <div className="panel p-3 text-xs space-y-2">
        <div className="font-display font-bold">Rules override (hypothetical only)</div>
        <div>Base: FUEL 1/1 active · L1 15 AUTO · 10/20/30 TELEOP · RP 100/360/50. Overrides are labeled hypothetical and excluded from default reports.</div>
        <div className="text-zinc-500">Desktop: `npm run dist` (Electron) · Web: GitHub Pages via `.github/workflows/pages.yml` (relative base). No API keys, no backend.</div>
        <div>FIRST, FRC, REBUILT are trademarks of FIRST. Unofficial tool, no endorsement.</div>
      </div>
    </div>
  );
}
