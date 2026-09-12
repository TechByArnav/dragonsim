import { useApp } from '../store';

const FEATURES = [
  { t: '3D Field Analysis', d: 'Dimensionally grounded REBUILT field (651.2×317.7 in), HUB/BUMP/TRENCH/TOWER/DEPOT/OUTPOST with inspectable coordinates, debug collision volumes, and measure tool.' },
  { t: 'Robot Archetypes + Prototype Models', d: '6 editable archetypes plus single-team Shenron placeholder. Detailed procedural robot + optional GLB import. Every number carries source/confidence.' },
  { t: 'Cycle-Time & Path Planning', d: 'Trapezoidal motion (never d/vmax), A* around obstacles, click-to-time, travel-time heatmaps in 6 modes.' },
  { t: 'Single-Robot Strategy', d: 'AUTO + TELEOP + Endgame presets with active-HUB gating. Inactive-HUB attempts score 0 and show lost time. Alliance sim deferred by design.' },
  { t: 'Heatmaps & Scoring Forecasts', d: 'Best/expected/conservative ranges, seeded Monte Carlo distributions, sensitivity, RP progress (100/360/50) — never guarantees.' },
];

export function Home() {
  const set = useApp((s) => s.set);
  return (
    <div className="min-h-full bg-gradient-to-b from-dragon-950 via-dragon-900 to-black">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <img src="./dragon.svg" alt="DragonSim mark" className="w-10 h-10" />
          <div>
            <div className="font-display font-bold text-2xl tracking-wide">DragonSim</div>
            <div className="text-xs text-zinc-400">FRC Team 422 · Mech Tech Dragons · Maggie L. Walker Governor's School</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => set({ view: 'simulate' })}>Open Simulator</button>
          <button className="btn-ghost" onClick={() => set({ view: 'field' })}>Explore Field</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 pb-16">
        <section className="panel p-8 mt-4 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="label">Local-first engineering decision-support · REBUILT 2026</div>
            <h1 className="font-display text-5xl font-bold mt-2">3D FRC robot<br />+ strategy simulator<br /><span className="text-dragon-500">for REBUILT.</span></h1>
            <p className="mt-4 text-zinc-300">Design cycles, test paths, forecast scores with uncertainty — tuned for one team: 422 Shenron. Field truth from official FE-2026 Rev B + TU22 manual. Estimates depend on your parameters and rules version.</p>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary" onClick={() => set({ view: 'simulate' })}>Open Simulator</button>
              <button className="btn-ghost" onClick={() => set({ view: 'field' })}>Explore Field</button>
            </div>
            <div className="mt-4 text-xs text-amber-200/90 border border-amber-300/20 bg-amber-400/10 rounded p-2">
              Estimates depend on entered robot parameters and current rules/field-data version (field v1.0.0 · rules TU22). Not a competition guarantee. FIRST Chesapeake events use the AndyMark field variant.
            </div>
          </div>
          <div className="panel p-4 font-mono text-xs leading-relaxed">
            <div className="label">Field truth snapshot (inches)</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>Footprint<br /><b>651.2 × 317.7</b></div>
              <div>HUB<br /><b>47×47 · open 41.7 @72h</b></div>
              <div>BUMP<br /><b>73×44.4×6.5 15°</b></div>
              <div>TRENCH clear<br /><b>50.34 × 22.25</b></div>
              <div>TOWER rungs<br /><b>27 / 45 / 63</b></div>
              <div>FUEL<br /><b>⌀5.91 · 0.45–0.50 lb</b></div>
            </div>
            <div className="mt-3 text-zinc-400">Scoring: active FUEL 1/1 · L1 15 AUTO · 10/20/30 TELEOP · RP 100/360/50 (regional). HUB alternates on AUTO winner.</div>
          </div>
        </section>
        <section className="grid md:grid-cols-3 gap-4 mt-6">
          {FEATURES.map((f) => (
            <div key={f.t} className="panel p-4">
              <div className="font-display font-bold text-lg text-dragon-500">{f.t}</div>
              <div className="text-sm text-zinc-300 mt-1">{f.d}</div>
            </div>
          ))}
          <div className="panel p-4 md:col-span-3">
            <div className="font-display font-bold text-lg">Data Sources</div>
            <ul className="text-sm text-zinc-300 list-disc ml-5 mt-1">
              <li>Game Manual TU22 (166 pp) — scoring, periods, HUB logic, robot limits</li>
              <li>FE-2026 Rev B dimension drawings (31 pp) + game-specific package (196 pp) + STEP (Onshape)</li>
              <li>Playing Field page + Season Materials (FIRST) · FUEL am-5801 (AndyMark)</li>
              <li>Local Context/ folder catalogued in-app — official assets only; no team prototype media yet</li>
            </ul>
            <div className="text-xs text-zinc-500 mt-2">FIRST, FIRST Robotics Competition, FRC, and REBUILT are trademarks of FIRST. DragonSim is an independent, unofficial analysis tool and is not affiliated with or endorsed by FIRST.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
