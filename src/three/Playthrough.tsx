import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useApp, allStrategies } from '../store';
import { planStrategy } from '../sim/strategy';
import { isActiveAt, hubWindows } from '../sim/scoring';
import { DetailedRobot } from './DetailedRobot';

const PTS: Record<string, { x: number; y: number }> = {
  neutralCenter: { x: 0, y: 0 }, hubScore: { x: -110, y: 20 },
  depotApproach: { x: -280, y: 100 }, outpostApproach: { x: -270, y: -120 },
  towerApproach: { x: -260, y: 0 }, start: { x: -230, y: -20 },
};

// Builds an illustrative waypoint loop from the active TELEOP preset.
// Times come from the motion model (see right panel); this player visualizes order + HUB gating.
export function usePlaythrough() {
  const s = useApp();
  return useMemo(() => {
    const robot = s.robot();
    const tele = allStrategies().find((x: any) => x.id === s.teleStrategyId) ?? allStrategies()[4];
    const plan = planStrategy(robot, tele, {
      alliance: s.alliance, autoWinner: s.autoWinner, teleopBudgetSec: 140,
      endgameCutoffSec: s.endgameId === 'end-skip' ? 0 : 12,
      congestionSec: s.congestion, defenseSec: s.defense, zone: s.zone, climbLevel: s.climbLevel,
    });
    const windows = hubWindows(s.alliance, s.autoWinner);
    // Waypoints: origin -> per-cycle collect -> score -> ... -> tower (if climb)
    const wps: { x: number; y: number; label: string; t: number; active: boolean; fuel?: number }[] = [];
    let t = 0;
    const seq = (tele as any).route?.length ? (tele as any).route : ['neutralCenter', 'hubScore'];
    wps.push({ x: s.origin.x, y: s.origin.y, label: 'Start — rollout', t, active: true });
    const cycles = Math.min(6, Math.max(2, plan.cycles));
    for (let c = 0; c < cycles; c++) {
      const cName = seq[c % seq.length] ?? 'neutralCenter';
      const cp = PTS[cName] ?? PTS.neutralCenter;
      t += 4;
      wps.push({ x: cp.x, y: cp.y, label: `Collect ${c + 1} — floor/chute`, t, active: true });
      t += 4;
      const scoreT = 20 + c * 16;
      const active = isActiveAt(scoreT, windows);
      wps.push({ x: PTS.hubScore.x, y: PTS.hubScore.y, label: active ? `Score ${c + 1} — HUB ACTIVE ✓` : `Hold ${c + 1} — HUB inactive, reposition`, t, active, fuel: active ? 10 : 0 });
    }
    if (s.climbLevel > 0) {
      t += 4;
      wps.push({ x: PTS.towerApproach.x, y: PTS.towerApproach.y, label: `Endgame — climb L${s.climbLevel}`, t, active: true });
    }
    return { wps, total: t + 2, teleName: (tele as any).name };
  }, [s.robotId, s.teleStrategyId, s.alliance, s.autoWinner, s.zone, s.climbLevel, s.endgameId, s.congestion, s.defense, s.origin.x, s.origin.y]);
}

export function PlaythroughRobot({ t }: { t: number }) {
  const { wps } = usePlaythrough();
  const s = useApp();
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => {
    if (!wps.length) return { x: s.origin.x, y: s.origin.y, heading: 0, idx: 0 };
    const clamped = Math.max(0, Math.min(t, wps[wps.length - 1].t));
    let i = 0;
    while (i < wps.length - 2 && wps[i + 1].t <= clamped) i++;
    const a = wps[i], b = wps[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    const f = Math.max(0, Math.min(1, (clamped - a.t) / span));
    // ease in-out for accel/brake feel
    const e = f * f * (3 - 2 * f);
    return {
      x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e,
      heading: Math.atan2(b.y - a.y, b.x - a.x), idx: i,
    };
  }, [t, wps, s.origin.x, s.origin.y]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.set(pos.x, pos.y, 0);
      ref.current.rotation.z = pos.heading;
    }
  });

  return (
    <group ref={ref} position={[pos.x, pos.y, 0]} rotation={[0, 0, pos.heading]}>
      <DetailedRobot position={[0, 0, 0]} alliance={s.alliance} />
      {/* lime trail ring */}
      <mesh position={[0, 0, 0.4]} rotation={[0, 0, 0]}>
        <ringGeometry args={[16, 18.5, 40]} />
        <meshBasicMaterial color="#7fee64" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function PlaythroughControls({ t, setT, playing, setPlaying, speed, setSpeed }: {
  t: number; setT: (v: number) => void; playing: boolean; setPlaying: (v: boolean) => void;
  speed: number; setSpeed: (v: number) => void;
}) {
  const { wps, total, teleName } = usePlaythrough();
  const cur = wps.reduce((acc, w, i) => (w.t <= t ? i : acc), 0);
  const curW = wps[cur];
  return (
    <div className="absolute bottom-2 left-2 right-2 codewin p-2 flex flex-col gap-1.5 text-xs" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="eyebrow">▶ Playthrough — {teleName}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${curW?.active ? 'bg-[#7fee64] text-black' : 'border border-[#485346] text-[#859984]'}`}>
          {curW?.active ? 'HUB ACTIVE' : 'HUB OFF'}
        </span>
        <span className="font-mono text-[#ddffdc]">{curW?.label}</span>
        <span className="ml-auto" />
        <button className="btn-primary !py-1 !px-3 text-xs" onClick={() => (t >= total - 0.01 ? (setT(0), setPlaying(true)) : setPlaying(!playing))}>
          {playing ? '⏸ Pause' : t > 0 && t < total - 0.01 ? '▶ Resume' : '▶ Play'}
        </button>
        <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => { setT(0); setPlaying(false); }}>↺</button>
        {[1, 2, 4].map((v) => (
          <button key={v} onClick={() => setSpeed(v)} className={`px-2 py-1 rounded-full border text-[11px] ${speed === v ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984]'}`}>{v}×</button>
        ))}
      </div>
      <input type="range" min={0} max={total} step={0.1} value={t} onChange={(e) => setT(+e.target.value)} />
      <div className="flex justify-between font-mono text-[11px] text-[#677d64]">
        <span>0s</span>
        <span>waypoint {cur + 1}/{wps.length} · illustrative motion (times from model, right panel)</span>
        <span>{total.toFixed(0)}s</span>
      </div>
    </div>
  );
}

export function useAutoAdvance() {
  return null;
}
