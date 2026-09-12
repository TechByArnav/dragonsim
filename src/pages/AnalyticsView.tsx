import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, LineChart, Line, CartesianGrid } from 'recharts';
import { useApp } from '../store';
import type { useSim } from './Workspace';
import { exportJSON, exportCSV } from '../lib/persist';

export function AnalyticsView({ sim }: { sim: ReturnType<typeof useSim> }) {
  const s = useApp();
  const r = sim.robot;
  const radar = useMemo(() => [
    { k: 'Speed', v: Math.round((r.vmaxInPerSec / 180) * 100) },
    { k: 'Agility', v: Math.round(r.maneuver * 100) },
    { k: 'Intake', v: Math.round((r.intakeRatePerSec / 2.5) * 100) },
    { k: 'Storage', v: Math.round((r.storage / 28) * 100) },
    { k: 'Accuracy', v: Math.round((r.accuracy?.[s.zone] ?? 0) * 100) },
    { k: 'Climb', v: Math.round((r.climb?.pSuccess ?? 0) * 100) },
  ], [r, s.zone]);
  const dist = useMemo(() => {
    const bins = new Map<number, number>();
    for (const v of sim.mc.samples) { const b = Math.round(v / 5) * 5; bins.set(b, (bins.get(b) ?? 0) + 1); }
    return [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([score, n]) => ({ score, n }));
  }, [sim.mc]);
  const cycles = useMemo(() => [
    { name: 'Collect', s: sim.plan.collectSec }, { name: 'Travel', s: sim.plan.travelSec },
    { name: 'Score', s: sim.plan.scoreSec }, { name: 'Lost-inactive', s: sim.plan.lostInactiveSec },
  ], [sim.plan]);
  const sens = [
    { name: 'Cycle −1s', d: sim.mc.topDrivers[0]?.delta ?? 0 },
    { name: 'Acc 85→70', d: sim.mc.topDrivers[1]?.delta ?? 0 },
    { name: 'Climb 95→70', d: sim.mc.topDrivers[2]?.delta ?? 0 },
  ];

  return (
    <div className="p-4 grid lg:grid-cols-2 gap-4 overflow-y-auto">
      <div className="panel p-3">
        <div className="font-display font-bold">Robot Profile — {r.name}</div>
        <div className="h-56"><ResponsiveContainer><RadarChart data={radar} outerRadius="75%"><PolarGrid /><PolarAngleAxis dataKey="k" tick={{ fill: '#aaa', fontSize: 11 }} /><Radar dataKey="v" stroke="#2BD96A" fill="#2BD96A" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></div>
        <div className="text-xs text-zinc-400">Source confidence: {(r as any).confidence ?? 'baseline-estimate'} · spec editable in Robots. Reliability: intake fail {r.intakeFail}, jam {r.jamProb}, mech risk {(r as any).mechRisk}.</div>
      </div>
      <div className="panel p-3">
        <div className="font-display font-bold">Score Forecast (estimated, seed {s.seed})</div>
        <div className="grid grid-cols-3 gap-2 text-center mt-1">
          <div className="kpi"><div className="label">Conservative p10</div><div className="font-display text-2xl font-bold">{sim.mc.p10.toFixed(0)}</div></div>
          <div className="kpi"><div className="label">Expected p50</div><div className="font-display text-2xl font-bold text-dragon-500">{sim.mc.p50.toFixed(0)}</div></div>
          <div className="kpi"><div className="label">Best p90</div><div className="font-display text-2xl font-bold">{sim.mc.p90.toFixed(0)}</div></div>
        </div>
        <div className="h-44 mt-2"><ResponsiveContainer><BarChart data={dist}><XAxis dataKey="score" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis tick={{ fill: '#aaa', fontSize: 10 }} /><Tooltip /><Bar dataKey="n" fill="#2BD96A" /></BarChart></ResponsiveContainer></div>
        <div className="text-xs font-mono mt-1">AUTO {sim.autoFuel} + active TELE {sim.scored.teleActive.toFixed(1)} (inactive attempted {sim.scored.teleInactiveAttempted.toFixed(0)} = 0pts) · missed {sim.scored.missed.toFixed(1)} · jam {sim.scored.jamLoss} · tower {sim.scored.towerPoints} · RP fuel {sim.scored.rpProgress.energized.toFixed(0)}/100/360 · traversal {sim.scored.rpProgress.traversalPts}/50</div>
      </div>
      <div className="panel p-3">
        <div className="font-display font-bold">Cycle Analysis</div>
        <div className="h-44"><ResponsiveContainer><BarChart data={cycles} layout="vertical"><XAxis type="number" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fill: '#aaa', fontSize: 11 }} width={90} /><Tooltip /><Bar dataKey="s" fill="#D9A441" /></BarChart></ResponsiveContainer></div>
        <div className="text-xs text-zinc-400">Bottleneck: {bottleneck(sim.plan)} · avg cycle {sim.avgCycle.toFixed(1)}s · {sim.plan.cycles} cycles · active-HUB pts/min {(sim.scored.fuelPoints / 2.33).toFixed(1)}</div>
      </div>
      <div className="panel p-3">
        <div className="font-display font-bold">Sensitivity (what moves the estimate)</div>
        <div className="h-44"><ResponsiveContainer><LineChart data={sens}><CartesianGrid stroke="#222" /><XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} /><YAxis tick={{ fill: '#aaa', fontSize: 10 }} /><Tooltip /><Line dataKey="d" stroke="#2BD96A" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        <ul className="text-xs mt-1">{sim.mc.topDrivers.map((d) => <li key={d.name}>· {d.name}: <b className="font-mono">{d.delta.toFixed(1)} pts</b></li>)}</ul>
        <div className="flex gap-2 mt-3 text-xs">
          <button className="btn-ghost !py-1" onClick={() => exportJSON(`dragonsim-${s.robotId}-${s.teleStrategyId}.json`, { robot: r, strategy: s.teleStrategyId, score: sim.scored, mc: { mean: sim.mc.mean, p10: sim.mc.p10, p50: sim.mc.p50, p90: sim.mc.p90 }, seed: s.seed })}>Export JSON</button>
          <button className="btn-ghost !py-1" onClick={() => exportCSV('dragonsim-cycles.csv', sim.plan.events.map((e) => ({ t: e.t.toFixed(1), kind: e.kind, detail: e.detail })))}>Export CSV</button>
          <button className="btn-ghost !py-1" onClick={() => window.print()}>Print report</button>
        </div>
      </div>
      <div className="panel p-3 lg:col-span-2 text-xs">
        <div className="font-display font-bold text-base">Strategy Report — {sim.tele.name}</div>
        <div>Purpose: {(sim.tele as any).purpose} · Route: {((sim.tele as any).route ?? []).join(' → ')} · Risks: {poor(sim.tele)} · Best when: HUB active windows align with short neutral cycles and climb cutoff respected.</div>
        <div className="text-zinc-400 mt-1">Single-robot planning model. Not a match predictor. Compare archetypes in Robots + re-run with different zone/congestion/defense to do robot-vs-strategy comparison (see README walkthrough).</div>
      </div>
    </div>
  );
}
function bottleneck(p: { collectSec: number; travelSec: number; scoreSec: number }) {
  const m: [string, number][] = [['collect', p.collectSec], ['travel', p.travelSec], ['score', p.scoreSec]];
  return m.sort((a, b) => b[1] - a[1])[0][0];
}
function poor(t: any) { return t.poorWhen ?? t.abandon ?? 'congestion + inactive-HUB waits'; }
