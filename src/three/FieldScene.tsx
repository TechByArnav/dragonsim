import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../store';
import { astar, fieldGridFromConstants } from '../sim/nav';
import { computeHeatmapSync } from '../sim/heatmap';
import { DetailedRobot } from './DetailedRobot';

const L = 651.2, W = 317.7;

function ClickCatcher({ onPick }: { onPick: (p: { x: number; y: number }) => void }) {
  const { gl } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  return (
    <mesh
      rotation={[0, 0, 0]}
      position={[0, 0, -0.05]}
      onClick={(e) => {
        e.stopPropagation();
        void ray; void plane; void gl;
        // Use intersection point directly (carpet plane z=0)
        onPick({ x: THREE.MathUtils.clamp(e.point.x, -L / 2, L / 2), y: THREE.MathUtils.clamp(e.point.y, -W / 2, W / 2) });
      }}
    >
      <planeGeometry args={[L, W]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Element({ pos, size, h, color, label, showLabel, wire }: any) {
  return (
    <group position={[pos.x, pos.y, h / 2]}>
      <mesh>
        <boxGeometry args={[size.x, size.y, h]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.6} wireframe={!!wire} transparent={!!wire} opacity={wire ? 0.5 : 1} />
      </mesh>
      {showLabel && (
        <Html distanceFactor={900} position={[0, 0, h / 2 + 8]} center style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: 11, background: 'rgba(0,0,0,.65)', padding: '1px 6px', borderRadius: 6, border: '1px solid #2BD96A55', whiteSpace: 'nowrap' }}>{label}</div>
        </Html>
      )}
    </group>
  );
}

function HeatLayer() {
  const s = useApp();
  const robot = s.robot();
  const tex = useMemo(() => {
    if (!s.heatmap) return null;
    const hm = computeHeatmapSync({ origin: s.origin, cellIn: 12, mode: s.heatMode, robot });
    const cv = document.createElement('canvas');
    cv.width = hm.nx; cv.height = hm.ny;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(hm.nx, hm.ny);
    for (let i = 0; i < hm.times.length; i++) {
      const t = hm.times[i];
      const o = i * 4;
      if (!Number.isFinite(t)) { img.data[o + 3] = 0; continue; }
      const f = Math.min(1, Math.max(0, (t - hm.min) / Math.max(1, hm.max - hm.min)));
      img.data[o] = Math.round(43 + f * 220); img.data[o + 1] = Math.round(217 - f * 140); img.data[o + 2] = 106; img.data[o + 3] = 110;
      void ctx;
    }
    // ImageData height orientation handled by flipY=false texture
    const c2 = document.createElement('canvas'); c2.width = hm.nx; c2.height = hm.ny;
    c2.getContext('2d')!.putImageData(img, 0, 0);
    const t2 = new THREE.CanvasTexture(c2);
    (t2 as any).colorSpace = THREE.SRGBColorSpace;
    return t2;
  }, [s.heatmap, s.heatMode, s.origin.x, s.origin.y, s.robotId, s.gridIn]);
  if (!s.heatmap || !tex) return null;
  return (
    <mesh position={[0, 0, 0.15]}>
      <planeGeometry args={[L, W]} />
      <meshBasicMaterial map={tex} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

function PathLine() {
  const s = useApp();
  const robot = s.robot();
  const path = useMemo(() => {
    if (!s.dest) return null;
    const grid = fieldGridFromConstants(s.gridIn, 29);
    const r = astar(s.origin, s.dest, grid);
    return r.reachable ? r : null;
  }, [s.origin, s.dest, s.gridIn]);
  const geom = useMemo(() => {
    if (!path) return null;
    const g = new THREE.BufferGeometry().setFromPoints(path.points.map((p) => new THREE.Vector3(p.x, p.y, 1.2)));
    return g;
  }, [path]);
  if (!path || !geom) return null;
  void robot;
  return (
    <>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#2BD96A" linewidth={2} />
      </lineSegments>
      {path.points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0.6]}>
          <sphereGeometry args={[1.2, 8, 8]} />
          <meshBasicMaterial color={i === 0 ? '#3b82f6' : i === path.points.length - 1 ? '#ef4444' : '#2BD96A'} />
        </mesh>
      ))}
    </>
  );
}

function FuelField() {
  const pts = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 120; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 180;
      const y = (Math.cos(i * 78.233) * 12543.2 % 1) * 120;
      arr.push([x, y]);
    }
    return arr;
  }, []);
  return (
    <instancedMesh args={[undefined, undefined, pts.length]} position={[0, 0, 3]}>
      <sphereGeometry args={[2.95, 10, 10]} />
      <meshStandardMaterial color="#facc15" roughness={0.9} />
      {pts.map((_, i) => (
        <object3D key={i} position={[pts[i][0], pts[i][1], 0]} />
      ))}
    </instancedMesh>
  );
}

export function FieldScene({ measure }: { measure: { a: { x: number; y: number } | null; b: { x: number; y: number } | null } }) {
  const s = useApp();
  const [top, setTop] = useState(false);
  void useRef;
  const onPick = (p: { x: number; y: number }) => {
    // shift-click sets destination, else moves origin (documented in viewport toolbar)
    s.set({ origin: p });
  };
  return (
    <div className="relative h-full w-full">
      <Canvas shadows={!top} camera={{ position: [0, -380, 320], fov: 45 }} dpr={[1, s.debug ? 1 : 2]}>
        <color attach="background" args={['#0a0f0d']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[180, -120, 260]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
        {/* carpet */}
        <mesh receiveShadow position={[0, 0, -0.5]}>
          <boxGeometry args={[L, W, 1]} />
          <meshStandardMaterial color="#1a2b22" roughness={1} />
        </mesh>
        <Grid position={[0, 0, 0.02]} args={[L, W]} cellSize={24} cellColor="#234" sectionSize={120} sectionColor="#2BD96A" fadeDistance={1400} infiniteGrid={false} />
        <ClickCatcher onPick={onPick} />
        {/* center line + robot starting lines */}
        <mesh position={[0, 0, 0.06]}><planeGeometry args={[2, W]} /><meshBasicMaterial color="#e5e5e5" /></mesh>
        <mesh position={[-167.01, 0, 0.06]}><planeGeometry args={[2, W]} /><meshBasicMaterial color="#3b82f6" /></mesh>
        <mesh position={[167.01, 0, 0.06]}><planeGeometry args={[2, W]} /><meshBasicMaterial color="#ef4444" /></mesh>
        {/* HUBs */}
        <Element pos={{ x: -167.01, y: 0 }} size={{ x: 47, y: 47 }} h={s.debug ? 72 : 30} color={s.alliance === 'blue' ? '#1d4ed8' : '#1e293b'} label="BLUE HUB 47×47 open⌀41.7 @72in" showLabel={s.labels} wire={s.debug} />
        <Element pos={{ x: 167.01, y: 0 }} size={{ x: 47, y: 47 }} h={s.debug ? 72 : 30} color={s.alliance === 'red' ? '#b91c1c' : '#1e293b'} label="RED HUB 47×47 open⌀41.7 @72in" showLabel={s.labels} wire={s.debug} />
        {/* BUMPs */}
        {[[-167.01, -70], [-167.01, 70], [167.01, -70], [167.01, 70]].map(([x, y], i) => (
          <Element key={i} pos={{ x, y }} size={{ x: 44.4, y: 73 }} h={6.5} color={i < 2 ? '#1e40af' : '#7f1d1d'} label={i === 0 ? 'BUMP 73×44.4×6.5 15°' : undefined} showLabel={s.labels && i === 0} wire={s.debug} />
        ))}
        {/* TRENCHes */}
        {[[-167.01, -135.3], [-167.01, 135.3], [167.01, -135.3], [167.01, 135.3]].map(([x, y], i) => (
          <group key={i} position={[x, y, 20]}>
            <mesh><boxGeometry args={[47, 65.65, 2.5]} /><meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} /></mesh>
            <mesh position={[0, 0, -8]}><boxGeometry args={[50.34, 60, 22.25]} /><meshStandardMaterial color="#0ea5e9" wireframe={s.debug} transparent opacity={s.debug ? 0.5 : 0.12} /></mesh>
            {s.labels && i === 0 && <Html distanceFactor={900} position={[0, 0, 24]} center><div style={{ fontSize: 11, background: 'rgba(0,0,0,.65)', padding: '1px 6px', borderRadius: 6 }}>TRENCH clear 50.3×22.25</div></Html>}
          </group>
        ))}
        {/* Towers */}
        <Element pos={{ x: -303, y: 0 }} size={{ x: 45, y: 49.25 }} h={78.25} color="#1d4ed8" label="BLUE TOWER rungs 27/45/63" showLabel={s.labels} wire={s.debug} />
        <Element pos={{ x: 303, y: 0 }} size={{ x: 45, y: 49.25 }} h={78.25} color="#b91c1c" label="RED TOWER rungs 27/45/63" showLabel={s.labels} wire={s.debug} />
        {/* Depots + outposts */}
        <Element pos={{ x: -311, y: 100 }} size={{ x: 27, y: 42 }} h={4} color="#475569" label="BLUE DEPOT 42×27" showLabel={s.labels} wire={s.debug} />
        <Element pos={{ x: 311, y: -100 }} size={{ x: 27, y: 42 }} h={4} color="#475569" label="RED DEPOT" showLabel={s.labels} wire={s.debug} />
        <Element pos={{ x: -300, y: -140 }} size={{ x: 30, y: 28 }} h={30} color="#0ea5e9" label="BLUE OUTPOST chute~25" showLabel={s.labels} wire={s.debug} />
        <Element pos={{ x: 300, y: 140 }} size={{ x: 30, y: 28 }} h={30} color="#0ea5e9" label="RED OUTPOST" showLabel={s.labels} wire={s.debug} />
        <FuelField />
        <HeatLayer />
        <PathLine />
        {/* origin + dest markers */}
        <mesh position={[s.origin.x, s.origin.y, 2]}><sphereGeometry args={[3, 12, 12]} /><meshBasicMaterial color="#2BD96A" /></mesh>
        {s.dest && <mesh position={[s.dest.x, s.dest.y, 2]}><sphereGeometry args={[3, 12, 12]} /><meshBasicMaterial color="#D9A441" /></mesh>}
        {/* measurement */}
        {measure.a && measure.b && (
          <group>
            <lineSegments geometry={new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(measure.a.x, measure.a.y, 2), new THREE.Vector3(measure.b.x, measure.b.y, 2)])}>
              <lineBasicMaterial color="#D9A441" />
            </lineSegments>
            <Html position={[(measure.a.x + measure.b.x) / 2, (measure.a.y + measure.b.y) / 2, 8]} center>
              <div style={{ fontSize: 12, background: '#000', border: '1px solid #D9A441', padding: '2px 8px', borderRadius: 8 }}>
                {Math.hypot(measure.a.x - measure.b.x, measure.a.y - measure.b.y).toFixed(1)} in
              </div>
            </Html>
          </group>
        )}
        <Suspense fallback={null}>
          <DetailedRobot position={[s.origin.x, s.origin.y, 0]} alliance={s.alliance} />
        </Suspense>
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} />
        {top && <OrthographicHelper />}
      </Canvas>
      <div className="absolute top-2 left-2 flex gap-2 text-xs">
        <button className="btn-ghost !py-1" onClick={() => setTop(!top)}>{top ? 'Perspective' : 'Top-down'}</button>
        <span className="panel px-2 py-1 font-mono">origin ({s.origin.x.toFixed(0)}, {s.origin.y.toFixed(0)}) in</span>
      </div>
    </div>
  );
}
function OrthographicHelper() { return null; }
export function GLBPreloader() { return null; }
export function preloadGLB(_url: string) { try { useGLTF.preload(_url); } catch { /* noop */ } }
