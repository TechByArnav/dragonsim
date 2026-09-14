import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useApp, allStrategies, allRobots } from '../store';
import { isActiveAt, hubWindows } from '../sim/scoring';
import { buildPlaythrough, MATCH_LEN } from '../sim/playthrough';
import { DetailedRobot } from './DetailedRobot';

export const SLOT_COLORS = ['#7fee64', '#22d3ee', '#f5c518'];

export function phaseAt(t: number): string {
  if (t < 20) return 'AUTO';
  if (t < 30) return 'TRANS';
  if (t < 55) return 'S1';
  if (t < 80) return 'S2';
  if (t < 105) return 'S3';
  if (t < 130) return 'S4';
  return 'END';
}

function robotSpecById(id: string) {
  const all = allRobots() as any[];
  return all.find((r) => r.id === id) ?? all[1];
}

// Thin store wrapper around the pure match-clock builder in sim/playthrough.ts.
export function usePlaythrough(slot = 0) {
  const s = useApp();
  return useMemo(() => {
    const ids = s.allianceMode ? s.allianceRobots : [s.robotId, s.robotId, s.robotId];
    const rid = ids[Math.min(slot, ids.length - 1)] ?? s.robotId;
    const robot = { ...robotSpecById(rid), ...((slot === 0 ? s.robotOverrides : {}) as object) };
    const tele = allStrategies().find((x: any) => x.id === s.teleStrategyId) ?? allStrategies()[4];
    const seq = (tele as any).route?.length ? (tele as any).route : ['neutralCenter', 'hubScore'];
    const rawRole = s.allianceMode ? s.allianceRoles[Math.min(slot, 2)] : 'scorer';
    const role = ['scorer', 'support', 'climb', 'defense'].includes(rawRole) ? rawRole : 'scorer';
    const built = buildPlaythrough({
      robot, routeSeq: seq, alliance: s.alliance, autoWinner: s.autoWinner,
      zone: s.zone, climbLevel: s.climbLevel, endgameId: s.endgameId,
      congestion: s.congestion + (s.allianceMode ? 0.5 : 0), defense: s.defense,
      origin: s.origin, gridIn: s.gridIn, slot, role,
    });
    const windows = hubWindows(s.alliance, s.autoWinner);
    return { ...built, windows, total: MATCH_LEN, teleName: (tele as any).name, robotName: (robot as any).name };
  }, [s.allianceMode, s.allianceRobots, s.allianceRoles, s.robotId, s.robotOverrides, s.teleStrategyId, s.alliance, s.autoWinner, s.zone, s.climbLevel, s.endgameId, s.congestion, s.defense, s.origin.x, s.origin.y, s.gridIn, slot]);
}

export function PlaythroughRobot({ t, slot = 0 }: { t: number; slot?: number }) {
  const { path, robotName } = usePlaythrough(slot);
  const s = useApp();
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => {
    if (!path.length) return { x: s.origin.x, y: s.origin.y, heading: 0, idx: 0, carry: 0 };
    const clamped = Math.max(0, Math.min(t, path[path.length - 1].t));
    let i = 0;
    while (i < path.length - 2 && path[i + 1].t <= clamped) i++;
    const a = path[i], b = path[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    const f = Math.max(0, Math.min(1, (clamped - a.t) / span));
    const e = f * f * (3 - 2 * f);
    return {
      x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e,
      heading: b.hd || a.hd || 0, idx: i,
      carry: f < 0.85 ? a.carry : b.carry,
    };
  }, [t, path, s.origin.x, s.origin.y]);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.set(pos.x, pos.y, 0);
      ref.current.rotation.z = pos.heading;
    }
  });
  const color = SLOT_COLORS[slot % 3];
  const shortName = String(robotName ?? '').split(' ')[0] ?? `R${slot + 1}`;

  return (
    <group ref={ref} position={[pos.x, pos.y, 0]} rotation={[0, 0, pos.heading]}>
      <DetailedRobot position={[0, 0, 0]} alliance={s.alliance} accent={color} carry={pos.carry} />
      <mesh position={[0, 0, 0.4]}>
        <ringGeometry args={[16, 18.5, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* floating name pill — small, floats above this robot */}
      <Html position={[0, 0, 48]} center distanceFactor={420} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Inter, sans-serif', color: '#000', background: color, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap', border: '2px solid #00000088' }}>
          R{slot + 1} · {shortName}
        </div>
      </Html>
    </group>
  );
}

// Full route trail per robot in its slot color (rendered once, outside the moving group).
export function PlaythroughTrail({ slot = 0 }: { slot?: number }) {
  const { path } = usePlaythrough(slot);
  const color = SLOT_COLORS[slot % 3];
  const geom = useMemo(() => {
    if (path.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(path.map((p) => new THREE.Vector3(p.x, p.y, 1.0)));
  }, [path]);
  useEffect(() => () => { geom?.dispose(); }, [geom]);
  if (!geom) return null;
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={0.55} />
    </lineSegments>
  );
}

// Live FUEL effects: balls arc robot→HUB on scores (green flash +N on hit,
// red flash + scattered balls on miss), cyan pulse on intake/feed, orange on jam.
export function ShotBursts({ t, slot = 0 }: { t: number; slot?: number }) {
  const { shots, pickups, hubX } = usePlaythrough(slot);
  const els: ReactNode[] = [];
  let k = 0;
  for (const p of pickups) {
    const dt = t - p.t;
    if (dt < 0 || dt > 0.9) continue;
    const f = dt / 0.9;
    const col = p.jam ? '#fb923c' : '#22d3ee';
    els.push(
      <mesh key={`p${slot}-${k++}`} position={[p.x, p.y, 2]}>
        <ringGeometry args={[14 + f * 22, 17 + f * 22, 32]} />
        <meshBasicMaterial color={col} transparent opacity={0.7 * (1 - f)} side={THREE.DoubleSide} />
      </mesh>
    );
    if (p.jam) {
      els.push(
        <Html key={`pj${slot}-${k++}`} position={[p.x, p.y, 34 + dt * 10]} center distanceFactor={420} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif', color: '#000', background: '#fb923c', padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>JAM</div>
        </Html>
      );
    }
  }
  for (const sh of shots) {
    const dt = t - sh.t;
    if (dt < 0 || dt > 1.7) continue;
    // 3 balls, staggered, arcing to the HUB mouth (true FUEL size)
    for (let i = 0; i < 3; i++) {
      const p = (dt - i * 0.12) / 0.7;
      if (p < 0) continue;
      const fly = Math.min(p, 1);
      const ex = sh.hit ? hubX : sh.x + (hubX - sh.x) * 0.62;
      const ey = sh.hit ? (i - 1) * 4 : sh.y + (0 - sh.y) * 0.62 + (i - 1) * 7;
      const x = sh.x + (ex - sh.x) * fly;
      const y = sh.y + (ey - sh.y) * fly;
      let z = 16 + (31 - 16) * fly + Math.sin(Math.PI * fly) * 15;
      let sc = 1;
      if (!sh.hit && p > 1) {
        // miss: drop short of the HUB and shrink away
        const d = Math.min((p - 1) / 0.5, 1);
        z = 16 - d * 13;
        sc = 1 - d * 0.85;
      } else if (sh.hit && p > 1) {
        sc = Math.max(0.01, 1 - (p - 1) * 2.2);
      }
      if (sc <= 0.02) continue;
      els.push(
        <mesh key={`b${slot}-${sh.t.toFixed(1)}-${i}`} position={[x, y, Math.max(z, 2.5)]} scale={sc}>
          <sphereGeometry args={[2.95, 10, 10]} />
          <meshStandardMaterial color="#f5c518" roughness={0.85} />
        </mesh>
      );
    }
    // impact flash + floating result
    if (dt > 0.45) {
      const f = Math.min((dt - 0.45) / 0.8, 1);
      const fx = sh.hit ? hubX : sh.x + (hubX - sh.x) * 0.62;
      const fy = sh.hit ? 0 : sh.y + (0 - sh.y) * 0.62;
      els.push(
        <mesh key={`f${slot}-${sh.t.toFixed(1)}`} position={[fx, fy, sh.hit ? 30 : 4]}>
          <ringGeometry args={[8 + f * 26, 12 + f * 26, 32]} />
          <meshBasicMaterial color={sh.hit ? '#7fee64' : '#ef4444'} transparent opacity={0.85 * (1 - f)} side={THREE.DoubleSide} />
        </mesh>
      );
      els.push(
        <Html key={`ft${slot}-${sh.t.toFixed(1)}`} position={[fx, fy, (sh.hit ? 44 : 22) + dt * 6]} center distanceFactor={420} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Inter, sans-serif', color: '#000', background: sh.hit ? '#7fee64' : '#ef4444', padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
            {sh.hit ? `+${sh.fuel}` : 'MISS'}
          </div>
        </Html>
      );
    }
  }
  return <group>{els}</group>;
}

function Dot({ c }: { c: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: 9999, background: c, display: 'inline-block' }} />;
}

export function PlaythroughControls({ t, setT, playing, setPlaying, speed, setSpeed }: {
  t: number; setT: (v: number) => void; playing: boolean; setPlaying: (v: boolean) => void;
  speed: number; setSpeed: (v: number) => void;
}) {
  const { path, total, teleName, shots, windows } = usePlaythrough(0);
  const cur = path.reduce((acc, w, i) => (w.t <= t ? i : acc), 0);
  const curW = path[cur];
  // transit points carry no label — show the most recent waypoint caption instead
  let caption = curW?.label ?? '';
  if (!caption) {
    for (let i = cur; i >= 0; i--) {
      if (path[i].label) { caption = path[i].label; break; }
    }
  }
  const hubLive = isActiveAt(t, windows);
  const phase = phaseAt(t);
  const done = shots.filter((sh) => sh.t <= t);
  const scored = done.filter((sh) => sh.hit).reduce((a, b) => a + b.fuel, 0);
  const missed = done.filter((sh) => !sh.hit).length;
  return (
    <div className="absolute bottom-2 left-2 right-2 codewin p-2 flex flex-col gap-1.5 text-xs" style={{ backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="eyebrow">▶ Playthrough — {teleName}</span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border border-[#485346] text-[#859984] font-mono">
          {phase} · {Math.max(0, MATCH_LEN - t).toFixed(0)}s left
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${hubLive ? 'bg-[#7fee64] text-black' : 'border border-[#485346] text-[#859984]'}`}>
          {hubLive ? 'HUB ACTIVE' : 'HUB OFF'}
        </span>
        <span className="font-mono text-[#ddffdc]">{caption}</span>
        <span className="font-mono text-[11px]">
          <span className="text-[#7fee64]">✓{scored}</span>
          <span className="text-[#677d64]"> · </span>
          <span className="text-[#ef4444]">✗{missed} miss</span>
        </span>
        <span className="ml-auto" />
        <button className="btn-primary !py-1 !px-3 text-xs" onClick={() => (t >= total - 0.01 ? (setT(0), setPlaying(true)) : setPlaying(!playing))}>
          {playing ? '⏸ Pause' : t > 0 && t < total - 0.01 ? '▶ Resume' : '▶ Play match'}
        </button>
        <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => { setT(0); setPlaying(false); }}>↺</button>
        {[1, 2, 4, 8].map((v) => (
          <button key={v} onClick={() => setSpeed(v)} className={`px-2 py-1 rounded-full border text-[11px] ${speed === v ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984]'}`}>{v}×</button>
        ))}
      </div>
      <input type="range" min={0} max={total} step={0.5} value={t} onChange={(e) => setT(+e.target.value)} />
      <div className="flex gap-3 font-mono text-[11px] text-[#677d64] flex-wrap">
        <span className="flex items-center gap-1"><Dot c="#7fee64" /> scored</span>
        <span className="flex items-center gap-1"><Dot c="#ef4444" /> miss</span>
        <span className="flex items-center gap-1"><Dot c="#fb923c" /> jam</span>
        <span className="flex items-center gap-1"><Dot c="#22d3ee" /> intake</span>
        <span className="ml-auto">full match · AUTO 0–20 · TELEOP 20–160</span>
      </div>
    </div>
  );
}
