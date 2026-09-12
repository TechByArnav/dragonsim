import { useApp, allRobots } from '../store';

const NUM_FIELDS: { key: string; label: string; min: number; max: number; step: number }[] = [
  { key: 'vmaxInPerSec', label: 'Max speed (in/s)', min: 60, max: 220, step: 1 },
  { key: 'amaxInPerSec2', label: 'Accel (in/s²)', min: 40, max: 200, step: 1 },
  { key: 'brakeInPerSec2', label: 'Brake (in/s²)', min: 40, max: 220, step: 1 },
  { key: 'omegaDegPerSec', label: 'Angular vel (°/s)', min: 120, max: 540, step: 5 },
  { key: 'intakeRatePerSec', label: 'Intake (FUEL/s)', min: 0.2, max: 4, step: 0.1 },
  { key: 'intakeFail', label: 'Intake fail rate', min: 0, max: 0.5, step: 0.01 },
  { key: 'storage', label: 'Storage', min: 1, max: 40, step: 1 },
  { key: 'releaseRatePerSec', label: 'Release (FUEL/s)', min: 0.2, max: 4, step: 0.1 },
  { key: 'spinUpSec', label: 'Spin-up (s)', min: 0, max: 2.5, step: 0.05 },
  { key: 'jamProb', label: 'Jam prob', min: 0, max: 0.2, step: 0.005 },
  { key: 'batteryDerate', label: 'Battery derate', min: 0.8, max: 1, step: 0.01 },
  { key: 'maneuver', label: 'Maneuverability', min: 0.3, max: 1, step: 0.01 },
];

export function RobotsView() {
  const s = useApp();
  const robot = s.robot();
  return (
    <div className="p-4 grid lg:grid-cols-3 gap-4 overflow-y-auto">
      <div className="panel p-3">
        <div className="label">Single-team library (6 archetypes + Shenron placeholder)</div>
        {allRobots().map((r: any) => (
          <button key={r.id} onClick={() => s.set({ robotId: r.id })}
            className={`block w-full text-left p-2 mt-2 rounded border text-xs ${s.robotId === r.id ? 'border-dragon-500 bg-dragon-500/10' : 'border-white/10'}`}>
            <div className="font-bold">{r.name} <span className="text-zinc-500">· {r.drivetrain}</span></div>
            <div className="text-zinc-400">{r.desc}</div>
            <div className="font-mono text-zinc-500 mt-1">conf: {r.confidence} · src: {r.source}</div>
          </button>
        ))}
        <div className="mt-3 text-xs">
          <div className="label">Import detailed GLB (optional)</div>
          <input type="file" accept=".glb,.gltf" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) s.set({ glbUrl: URL.createObjectURL(f) });
          }} />
          {s.glbUrl && <button className="btn-ghost mt-2 !py-1" onClick={() => s.set({ glbUrl: null })}>Use procedural model</button>}
          <div className="text-zinc-500 mt-1">Procedural model is the default detailed engineering view (swerve, intake, shooter, climber, bumpers). GLB overrides body only; collision stays from footprint.</div>
        </div>
      </div>
      <div className="panel p-3 lg:col-span-2">
        <div className="font-display font-bold text-xl">{robot.name} — editable spec</div>
        <div className="text-xs text-amber-200/80">Baseline engineering estimates. Mark provenance; nothing here is a measured Shenron fact until you enter it.</div>
        <div className="grid md:grid-cols-2 gap-x-6 mt-2">
          {NUM_FIELDS.map((f) => (
            <label key={f.key} className="text-xs block mt-2">
              <span className="flex justify-between"><span>{f.label}</span><b className="font-mono">{String(robot[f.key] ?? '')}</b></span>
              <input type="range" min={f.min} max={f.max} step={f.step} value={Number(robot[f.key] ?? f.min)}
                onChange={(e) => s.set({ robotOverrides: { ...s.robotOverrides, [f.key]: +e.target.value } })} />
            </label>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-2 mt-3 text-xs">
          {(['close', 'mid', 'long'] as const).map((z) => (
            <label key={z}>Accuracy {z} ({Math.round((robot.accuracy?.[z] ?? 0) * 100)}%)
              <input type="range" min={0.2} max={0.99} step={0.01} value={robot.accuracy?.[z] ?? 0.8}
                onChange={(e) => s.set({ robotOverrides: { ...s.robotOverrides, accuracy: { ...robot.accuracy, [z]: +e.target.value } } as any })} />
            </label>
          ))}
        </div>
        <div className="grid md:grid-cols-4 gap-2 mt-2 text-xs">
          <label>Climb level<select value={s.climbLevel} onChange={(e) => s.set({ climbLevel: +e.target.value as any })}><option value={0}>none</option><option value={1}>L1</option><option value={2}>L2</option><option value={3}>L3</option></select></label>
          <label>Climb p<input type="number" step={0.01} min={0} max={1} value={robot.climb?.pSuccess ?? 0.8} onChange={(e) => s.set({ robotOverrides: { ...s.robotOverrides, climb: { ...robot.climb, pSuccess: +e.target.value } } as any })} /></label>
          <label>Footprint X<input type="number" value={robot.footprintIn?.x ?? 29} onChange={(e) => s.set({ robotOverrides: { ...s.robotOverrides, footprintIn: { ...robot.footprintIn, x: +e.target.value } } as any })} /></label>
          <label>Mass lb<input type="number" value={robot.massLb ?? 114} onChange={(e) => s.set({ robotOverrides: { ...s.robotOverrides, massLb: +e.target.value } })} /></label>
        </div>
        {Object.keys(s.robotOverrides).length > 0 && (
          <button className="btn-ghost mt-3 !py-1 text-xs" onClick={() => s.set({ robotOverrides: {} })}>Reset overrides to archetype baseline</button>
        )}
        <div className="text-[11px] text-zinc-500 mt-2">Robot limits (TU22): 115 lb · 110 in perimeter · 30 in start height · +12 in extension one direction · 30 in vertical limit (R107 — verify vs climber).</div>
      </div>
    </div>
  );
}
