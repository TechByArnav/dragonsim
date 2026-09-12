import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useApp, allStrategies, allRobots } from '../store';
import { planStrategy } from '../sim/strategy';
import { isActiveAt, hubWindows } from '../sim/scoring';
import { astar, clampOutOfColliders, fieldGridFromConstants } from '../sim/nav';
import { DetailedRobot } from './DetailedRobot';

const PTS: Record<string, { x: number; y: number }> = {
  neutralCenter: { x: 0, y: 0 }, hubScore: { x: -110, y: 20 },
  depotApproach: { x: -280, y: 100 }, outpostApproach: { x: -270, y: -120 },
  towerApproach: { x: -258, y: 0 }, start: { x: -230, y: -20 },
  hubAdjacent: { x: -140, y: 20 }, shootZone: { x: -100, y: 60 },
  reload: { x: -60, y: 40 }, neutral: { x: 0, y: 0 },
  corral: { x: -260, y: -100 }, 'lane-block': { x: -60, y: -80 },
  allianceZone: { x: -250, y: 0 },
};

export const SLOT_COLORS = ['#7fee64', '#22d3ee', '#f5c518'];
const SLOT_OFFSET = [0, 16, -16];

function robotSpecById(id: string) {
  const all = allRobots() as any[];
  return all.find((r) => r.id === id) ?? all[1];
}

// Expand waypoint names into a dense, collision-free polyline via A*.
// Each robot slot gets a lateral lane offset so 3 robots don't stack.
export function usePlaythrough(slot = 0) {
  const s = useApp();
  return useMemo(() => {
    const ids = s.allianceMode ? s.allianceRobots : [s.robotId, s.robotId, s.robotId];
    const rid = ids[Math.min(slot, ids.length - 1)] ?? s.robotId;
    const robot = { ...robotSpecById(rid), ...((slot === 0 ? s.robotOverrides : {}) as object) };
    const tele = allStrategies().find((x: any) => x.id === s.teleStrategyId) ?? allStrategies()[4];
    const plan = planStrategy(robot, tele, {
      alliance: s.alliance, autoWinner: s.autoWinner, teleopBudgetSec: 140,
      endgameCutoffSec: s.endgameId === 'end-skip' ? 0 : 12,
      congestionSec: s.congestion + (s.allianceMode ? 0.5 : 0), defenseSec: s.defense, zone: s.zone, climbLevel: s.climbLevel,
    });
    const windows = hubWindows(s.alliance, s.autoWinner);
    const grid = fieldGridFromConstants(s.gridIn, 29);
    const lane = SLOT_OFFSET[Math.min(slot, 2)] ?? 0;

    const names: { name: string; label: string; active: boolean }[] = [];
    const seq = (tele as any).route?.length ? (tele as any).route : ['neutralCenter', 'hubScore'];
    const startSafe = clampOutOfColliders({ x: s.origin.x + lane * 0.4, y: s.origin.y + lane });
    names.push({ name: '__start__', label: `R${slot + 1} Start — rollout`, active: true });
    const cycles = Math.min(5, Math.max(2, plan.cycles));
    for (let c = 0; c < cycles; c++) {
      // support/climb roles do fewer scoring runs: hold lanes instead of forcing HUB
      const role = s.allianceMode ? s.allianceRoles[Math.min(slot, 2)] : 'scorer';
      const cName = role === 'climb' && c >= 2 ? 'towerApproach' : role === 'support' && c % 2 === 1 ? 'corral' : seq[c % seq.length] ?? 'neutralCenter';
      names.push({ name: cName, label: `R${slot + 1} Collect ${c + 1}`, active: true });
      const scoreT = 20 + c * 16;
      const active = isActiveAt(scoreT, windows);
      names.push({ name: 'hubScore', label: active ? `R${slot + 1} Score ${c + 1} ✓` : `R${slot + 1} Hold ${c + 1} — HUB off`, active });
    }
    if (s.climbLevel > 0 && (slot === 0 || (s.allianceMode && s.allianceRoles[slot] === 'climb'))) {
      names.push({ name: 'towerApproach', label: `R${slot + 1} Climb L${s.climbLevel}`, active: true });
    }

    // Expand legs through A* so robots drive AROUND hubs/towers — never through.
    const dense: { x: number; y: number; t: number; label: string; active: boolean }[] = [];
    let cursor = startSafe;
    let t = 0;
    const pushPt = (x: number, y: number, label: string, active: boolean, dt: number) => {
      t += dt;
      dense.push({ x, y, t, label, active });
    };
    pushPt(cursor.x, cursor.y, names[0].label, true, 0.01);
    for (let i = 1; i < names.length; i++) {
      const target = names[i].name === '__start__' ? startSafe : clampOutOfColliders(PTS[names[i].name] ?? PTS.neutralCenter);
      const leg = astar(cursor, target, grid);
      const pts = leg.reachable ? leg.points : [cursor, target];
      // lateral lane offset on intermediate points only (keeps collect/score exact)
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k];
        const prev = pts[k - 1];
        const dx = p.x - prev.x, dy = p.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const isEnd = k === pts.length - 1;
        const off = isEnd ? 0 : lane;
        const ox = p.x + (-dy / len) * off;
        const oy = p.y + (dx / len) * off;
        const safe = clampOutOfColliders({ x: ox, y: oy });
        const segLen = Math.hypot(safe.x - (dense.length ? dense[dense.length - 1].x : cursor.x), safe.y - (dense.length ? dense[dense.length - 1].y : cursor.y));
        pushPt(safe.x, safe.y, i === names.length - 1 || k === pts.length - 1 ? names[i].label : '', names[i].active, 0.12 + segLen / 260);
      }
      cursor = target;
    }
    return { path: dense, total: t + 1, teleName: (tele as any).name, robotName: (robot as any).name };
  }, [s.allianceMode, s.allianceRobots, s.allianceRoles, s.robotId, s.robotOverrides, s.teleStrategyId, s.alliance, s.autoWinner, s.zone, s.climbLevel, s.endgameId, s.congestion, s.defense, s.origin.x, s.origin.y, s.gridIn, slot]);
}

export function PlaythroughRobot({ t, slot = 0 }: { t: number; slot?: number }) {
  const { path } = usePlaythrough(slot);
  const s = useApp();
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => {
    if (!path.length) return { x: s.origin.x, y: s.origin.y, heading: 0, idx: 0 };
    const clamped = Math.max(0, Math.min(t, path[path.length - 1].t));
    let i = 0;
    while (i < path.length - 2 && path[i + 1].t <= clamped) i++;
    const a = path[i], b = path[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    const f = Math.max(0, Math.min(1, (clamped - a.t) / span));
    const e = f * f * (3 - 2 * f);
    return {
      x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e,
      heading: Math.atan2(b.y - a.y, b.x - a.x) || 0, idx: i,
    };
  }, [t, path, s.origin.x, s.origin.y]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.set(pos.x, pos.y, 0);
      ref.current.rotation.z = pos.heading;
    }
  });
  const color = SLOT_COLORS[slot % 3];

  return (
    <group ref={ref} position={[pos.x, pos.y, 0]} rotation={[0, 0, pos.heading]}>
      <DetailedRobot position={[0, 0, 0]} alliance={s.alliance} />
      <mesh position={[0, 0, 0.4]}>
        <ringGeometry args={[16, 18.5, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function PlaythroughControls({ t, setT, playing, setPlaying, speed, setSpeed }: {
  t: number; setT: (v: number) => void; playing: boolean; setPlaying: (v: boolean) => void;
  speed: number; setSpeed: (v: number) => void;
}) {
  const { path, total, teleName } = usePlaythrough(0);
  const cur = path.reduce((acc, w, i) => (w.t <= t ? i : acc), 0);
  const curW = path[cur];
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
          {playing ? '⏸ Pause' : t > 0 && t < total - 0.01 ? '▶ Resume' : '▶ Play strategy'}
        </button>
        <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => { setT(0); setPlaying(false); }}>↺</button>
        {[1, 2, 4].map((v) => (
          <button key={v} onClick={() => setSpeed(v)} className={`px-2 py-1 rounded-full border text-[11px] ${speed === v ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984]'}`}>{v}×</button>
        ))}
      </div>
      <input type="range" min={0} max={total} step={0.1} value={t} onChange={(e) => setT(+e.target.value)} />
      <div className="flex justify-between font-mono text-[11px] text-[#677d64]">
        <span>0s</span>
        <span>collision-free A* path · times from motion model</span>
        <span>{total.toFixed(0)}s</span>
      </div>
    </div>
  );
}
