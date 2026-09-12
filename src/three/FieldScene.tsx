import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../store';
import { astar, clampOutOfColliders, fieldGridFromConstants } from '../sim/nav';
import { computeHeatmapSync } from '../sim/heatmap';
import { PlaythroughRobot, PlaythroughControls, usePlaythrough } from './Playthrough';

const L = 651.2, W = 317.7;
const LIME = '#7fee64';

function ClickCatcher({ onPick }: { onPick: (p: { x: number; y: number }) => void }) {
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  return (
    <mesh position={[0, 0, -0.05]} onClick={(e) => {
      e.stopPropagation(); void ray; void plane;
      const raw = { x: THREE.MathUtils.clamp(e.point.x, -L / 2, L / 2), y: THREE.MathUtils.clamp(e.point.y, -W / 2, W / 2) };
      onPick(clampOutOfColliders(raw)); // never place the robot inside a hub/tower
    }}>
      <planeGeometry args={[L, W]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Label({ pos, text }: { pos: [number, number, number]; text: string }) {
  const s = useApp();
  if (!s.labels) return null;
  return (
    <Html distanceFactor={1500} position={pos} center style={{ pointerEvents: 'none' }} occlude={false}>
      <div style={{ fontSize: 9, lineHeight: 1.2, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,0,0,.55)', color: '#aed2a4', padding: '0px 5px', borderRadius: 5, border: '1px solid #48534688', whiteSpace: 'nowrap', opacity: 0.9 }}>{text}</div>
    </Html>
  );
}

// Pulsing HUB status ring — vivid lime only when that alliance hub is "active" in the sim.
function HubPulse({ x, alliance }: { x: number; alliance: 'red' | 'blue' }) {
  const s = useApp();
  const ref = useRef<THREE.Mesh>(null);
  const active = s.alliance === alliance; // simplified: viewed alliance hub glows; full SHIFT logic in right panel
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = (Math.sin(clock.elapsedTime * 2.4) + 1) / 2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = active ? 0.35 + p * 0.4 : 0.08;
    const sc = active ? 1 + p * 0.03 : 1;
    ref.current.scale.set(sc, sc, 1);
  });
  return (
    <mesh ref={ref} position={[x, 0, 0.3]} rotation={[0, 0, 0]}>
      <ringGeometry args={[30, 36, 6]} />
      <meshBasicMaterial color={active ? LIME : '#485346'} transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Hub({ x, alliance, label }: { x: number; alliance: 'red' | 'blue'; label: string }) {
  const s = useApp();
  const body = alliance === 'blue' ? '#1c2f4a' : '#4a1f1f';
  return (
    <group position={[x, 0, 0]}>
      {/* base prism 47x47, ~30in visual height (true opening 72in shown as mast in debug) */}
      <mesh position={[0, 0, 15]} castShadow receiveShadow>
        <boxGeometry args={[47, 47, 30]} />
        <meshStandardMaterial color={body} metalness={0.35} roughness={0.55} />
      </mesh>
      {/* top rim + hexagonal opening */}
      <mesh position={[0, 0, 30.6]} castShadow>
        <cylinderGeometry args={[26, 26, 1.6, 6]} />
        <meshStandardMaterial color="#0b0d0c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 30.2]}>
        <cylinderGeometry args={[20.8, 20.8, 1.2, 6]} />
        <meshStandardMaterial color="#000000" roughness={1} />
      </mesh>
      {/* DMX light bars on top edges */}
      {[-23, 0, 23].map((o, i) => (
        <mesh key={i} position={[o, 23.2, 31.5]}>
          <boxGeometry args={[10, 0.8, 0.8]} />
          <meshStandardMaterial color="#111" emissive={s.alliance === alliance ? LIME : '#333'} emissiveIntensity={s.alliance === alliance ? 2.2 : 0.4} />
        </mesh>
      ))}
      {/* 4 base exits toward neutral zone */}
      {[-15, -5, 5, 15].map((o, i) => (
        <mesh key={i} position={[alliance === 'blue' ? 24 : -24, o, 3]}>
          <boxGeometry args={[2.5, 7, 5]} />
          <meshStandardMaterial color="#050505" roughness={0.9} />
        </mesh>
      ))}
      {/* rear net */}
      <mesh position={[alliance === 'blue' ? -24.5 : 24.5, 0, 45]}>
        <planeGeometry args={[44, 30]} />
        <meshStandardMaterial color="#9aa5a0" transparent opacity={0.28} side={THREE.DoubleSide} wireframe />
      </mesh>
      <HubPulse x={0} alliance={alliance} />
      <group position={[0, 0, 0]}><Label pos={[0, 0, 42]} text={label} /></group>
    </group>
  );
}

function Bump({ x, y, color }: { x: number; y: number; color: string }) {
  // Two 15° HDPE ramps: neutral-side + alliance-side
  return (
    <group position={[x, y, 0]}>
      {[-1, 1].map((dir) => (
        <mesh key={dir} position={[(dir * 44.4) / 4, 0, 3.1]} rotation={[0, dir * (15 * Math.PI / 180), 0]} castShadow receiveShadow>
          <boxGeometry args={[24.5, 73, 0.9]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
      <mesh position={[0, 0, 6.2]}>
        <boxGeometry args={[3, 73, 0.7]} />
        <meshStandardMaterial color="#0c0e0d" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Trench({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0]}>
      {/* two legs + top beam */}
      {[-28, 28].map((o) => (
        <mesh key={o} position={[0, o, 20]} castShadow>
          <boxGeometry args={[47, 4.5, 40.25]} />
          <meshStandardMaterial color="#2a3138" metalness={0.55} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 0, 39]} castShadow>
        <boxGeometry args={[47, 65.65, 2.6]} />
        <meshStandardMaterial color="#39424c" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* under-clearance volume hint */}
      <mesh position={[0, 0, 11.1]}>
        <boxGeometry args={[50.34, 56, 22.25]} />
        <meshStandardMaterial color="#7fee64" wireframe transparent opacity={0.14} />
      </mesh>
      {/* AprilTag panel on beam */}
      <mesh position={[0, 0, 35]}>
        <boxGeometry args={[10.5, 10.5, 0.4]} />
        <meshStandardMaterial color="#e8ece8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 34.7]}>
        <boxGeometry args={[8.125, 8.125, 0.5]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Tower({ x, alliance }: { x: number; alliance: 'red' | 'blue' }) {
  const paint = alliance === 'blue' ? '#1d4ed8' : '#b91c1c';
  return (
    <group position={[x, 0, 0]}>
      {/* base plate */}
      <mesh position={[0, 0, 0.35]} receiveShadow>
        <boxGeometry args={[45.18, 39, 0.7]} />
        <meshStandardMaterial color="#3a3f45" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* uprights */}
      {[-16.125, 16.125].map((o) => (
        <mesh key={o} position={[0, o, 36]} castShadow>
          <boxGeometry args={[3.5, 3.5, 72.1]} />
          <meshStandardMaterial color={paint} metalness={0.5} roughness={0.45} />
        </mesh>
      ))}
      {/* 3 rungs */}
      {[27, 45, 63].map((h) => (
        <group key={h}>
          <mesh position={[0, 0, h]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.83, 0.83, 44, 14]} />
            <meshStandardMaterial color={paint} metalness={0.65} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* wall tie */}
      <mesh position={[(alliance === 'blue' ? -1 : 1) * 22, 0, 36]}>
        <boxGeometry args={[4, 49.25, 15]} />
        <meshStandardMaterial color="#22262b" metalness={0.6} roughness={0.5} />
      </mesh>
      <Label pos={[0, 0, 84]} text={`${alliance.toUpperCase()} TOWER · 27/45/63`} />
    </group>
  );
}

function Depot({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <group position={[x, y, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, -14 + i * 14, 1.6]} castShadow>
          <boxGeometry args={[27, 2.2, 1.6]} />
          <meshStandardMaterial color="#8b9299" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <Label pos={[0, 0, 10]} text={label} />
    </group>
  );
}

function Outpost({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, 15]} castShadow>
        <boxGeometry args={[26, 24, 30]} />
        <meshStandardMaterial color="#232a31" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* chute mouth (upper) + corral (base) */}
      <mesh position={[0, 13, 28]}><boxGeometry args={[31.8, 1.5, 7]} /><meshStandardMaterial color="#050505" /></mesh>
      <mesh position={[0, 13, 4]}><boxGeometry args={[32, 1.5, 7]} /><meshStandardMaterial color="#050505" /></mesh>
      {/* corral polycarb */}
      <mesh position={[0, 20, 4]}>
        <boxGeometry args={[35.8, 8, 8.13]} />
        <meshStandardMaterial color="#9fd8ff" transparent opacity={0.22} roughness={0.2} />
      </mesh>
      <Label pos={[0, 0, 36]} text={label} />
    </group>
  );
}

function AprilTag({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh><boxGeometry args={[10.5, 0.4, 10.5]} /><meshStandardMaterial color="#dfe5df" /></mesh>
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[8.125, 0.5, 8.125]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

function HeatLayer() {
  const s = useApp();
  const robot = s.robot();
  const tex = useMemo(() => {
    if (!s.heatmap) return null;
    const hm = computeHeatmapSync({ origin: s.origin, cellIn: 12, mode: s.heatMode, robot });
    const c2 = document.createElement('canvas'); c2.width = hm.nx; c2.height = hm.ny;
    const ctx = c2.getContext('2d')!;
    const img = ctx.createImageData(hm.nx, hm.ny);
    for (let i = 0; i < hm.times.length; i++) {
      const t = hm.times[i]; const o = i * 4;
      if (!Number.isFinite(t)) { img.data[o + 3] = 0; continue; }
      const f = Math.min(1, Math.max(0, (t - hm.min) / Math.max(1, hm.max - hm.min)));
      img.data[o] = Math.round(127 - f * 60); img.data[o + 1] = Math.round(238 - f * 120); img.data[o + 2] = 100; img.data[o + 3] = 115;
    }
    ctx.putImageData(img, 0, 0);
    const t2 = new THREE.CanvasTexture(c2);
    (t2 as any).colorSpace = THREE.SRGBColorSpace;
    return t2;
  }, [s.heatmap, s.heatMode, s.origin.x, s.origin.y, s.robotId, s.gridIn]);
  if (!s.heatmap || !tex) return null;
  return (
    <mesh position={[0, 0, 0.18]}>
      <planeGeometry args={[L, W]} />
      <meshBasicMaterial map={tex} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  );
}

function PathLine() {
  const s = useApp();
  const path = useMemo(() => {
    if (!s.dest) return null;
    const grid = fieldGridFromConstants(s.gridIn, 29);
    const r = astar(s.origin, s.dest, grid);
    return r.reachable ? r : null;
  }, [s.origin, s.dest, s.gridIn]);
  const geom = useMemo(() => {
    if (!path) return null;
    return new THREE.BufferGeometry().setFromPoints(path.points.map((p) => new THREE.Vector3(p.x, p.y, 1.4)));
  }, [path]);
  if (!path || !geom) return null;
  return (
    <>
      {/* glow underlay + core line */}
      <lineSegments geometry={geom}><lineBasicMaterial color="#7fee64" transparent opacity={0.28} linewidth={4} /></lineSegments>
      <lineSegments geometry={geom}><lineBasicMaterial color="#ddffdc" linewidth={1.5} /></lineSegments>
      {path.points.filter((_, i) => i % 3 === 0).map((p, i) => (
        <mesh key={i} position={[p.x, p.y, 0.7]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={LIME} transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

function FuelPiles() {
  const piles = useMemo(() => {
    const rnd = (i: number, k: number) => {
      const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    const pts: { x: number; y: number; z: number }[] = [];
    // neutral pile ~206x72 box, split at center
    for (let i = 0; i < 150; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      pts.push({ x: (rnd(i, 1) - 0.5) * 200, y: side * (8 + rnd(i, 2) * 30) + (rnd(i, 3) - 0.5) * 8, z: 2.95 + (i % 3) * 2.2 });
    }
    // depots + chutes
    for (let i = 0; i < 24; i++) {
      pts.push({ x: -311 + (rnd(i, 4) - 0.5) * 20, y: 100 + (rnd(i, 5) - 0.5) * 34, z: 2.9 });
      pts.push({ x: 311 + (rnd(i, 6) - 0.5) * 20, y: -100 + (rnd(i, 7) - 0.5) * 34, z: 2.9 });
    }
    return pts;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useMemo(() => {
    // positions applied via dummy Object3D below
  }, []);
  void ref;
  return (
    <instancedMesh args={[undefined, undefined, piles.length]} position={[0, 0, 0]} castShadow>
      <sphereGeometry args={[2.95, 12, 12]} />
      <meshStandardMaterial color="#f5c518" roughness={0.85} metalness={0.02} />
      {piles.map((p, i) => (
        <object3D key={i} position={[p.x, p.y, p.z]} />
      ))}
    </instancedMesh>
  );
}

function CameraRig({ preset }: { preset: string }) {
  const { camera } = useThree();
  useMemo(() => {
    if (preset === 'top') camera.position.set(0, 0, 720);
    else if (preset === 'side') camera.position.set(0, -560, 110);
    else if (preset === 'end') camera.position.set(-560, 0, 150);
    else if (preset === 'corner') camera.position.set(-380, -320, 300);
    else if (preset === 'driverBlue') camera.position.set(-380, 0, 70);
    else if (preset === 'driverRed') camera.position.set(380, 0, 70);
    else if (preset === 'hub') camera.position.set(-167, -170, 130);
    else camera.position.set(0, -380, 320);
    camera.lookAt(0, 0, 0);
  }, [preset, camera]);
  return null;
}

function Animator({ playing, speed, total, setT }: { playing: boolean; speed: number; total: number; setT: React.Dispatch<React.SetStateAction<number>> }) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((prev) => {
      const nt = prev + 0.12 * speed;
      return nt >= total ? total : nt;
    }), 100);
    return () => clearInterval(id);
  }, [playing, speed, total, setT]);
  return null;
}

export function FieldScene({ measure }: { measure: { a: { x: number; y: number } | null; b: { x: number; y: number } | null } }) {
  const s = useApp();
  const [cam, setCam] = useState('persp');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0);
  const { total } = usePlaythrough();
  useEffect(() => { if (t >= total && playing) setPlaying(false); }, [t, total, playing]);
  const onPick = (p: { x: number; y: number }) => s.set({ origin: p });

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas shadows camera={{ position: [0, -380, 320], fov: 45 }} dpr={[1, s.debug ? 1 : 2]}>
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 900, 1600]} />
        <hemisphereLight args={['#ddffdc', '#0a0f0c', 0.5]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[180, -120, 280]} intensity={1.25} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-360} shadow-camera-right={360} shadow-camera-top={200} shadow-camera-bottom={-200} />
        <pointLight position={[-167, 0, 120]} intensity={s.alliance === 'blue' ? 60 : 8} color={LIME} distance={320} />
        <pointLight position={[167, 0, 120]} intensity={s.alliance === 'red' ? 60 : 8} color={LIME} distance={320} />
        <CameraRig preset={cam} />
        {/* carpet + border glow */}
        <mesh receiveShadow position={[0, 0, -0.6]}>
          <boxGeometry args={[L + 8, W + 8, 1.2]} />
          <meshStandardMaterial color="#0b100e" roughness={1} />
        </mesh>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[L, W, 0.5]} />
          <meshStandardMaterial color="#101915" roughness={0.96} />
        </mesh>
        <Grid position={[0, 0, 0.3]} args={[L, W]} cellSize={24} cellColor="#1f2a33" sectionSize={120} sectionColor="#485346" fadeDistance={1500} infiniteGrid={false} />
        {/* guardrails: polycarbonate + extrusion */}
        {[-W / 2, W / 2].map((y) => (
          <group key={y} position={[0, y, 10]}>
            <mesh><boxGeometry args={[L, 1.2, 20]} /><meshStandardMaterial color="#9fb3ad" transparent opacity={0.16} roughness={0.15} metalness={0.1} /></mesh>
            <mesh position={[0, 0, 10.6]}><boxGeometry args={[L, 2, 1.4]} /><meshStandardMaterial color="#3a4149" metalness={0.7} roughness={0.4} /></mesh>
            <mesh position={[0, 0, -10.6]}><boxGeometry args={[L, 2, 1.4]} /><meshStandardMaterial color="#3a4149" metalness={0.7} roughness={0.4} /></mesh>
          </group>
        ))}
        {/* alliance walls */}
        {[-L / 2, L / 2].map((x) => (
          <group key={x} position={[x, 0, 21]}>
            <mesh><boxGeometry args={[2, W, 42]} /><meshStandardMaterial color="#14181b" metalness={0.4} roughness={0.6} /></mesh>
            <mesh position={[0, 0, 24]}><boxGeometry args={[2.6, W, 3]} /><meshStandardMaterial color={x < 0 ? '#1d4ed8' : '#b91c1c'} emissive={x < 0 ? '#1d4ed8' : '#b91c1c'} emissiveIntensity={0.35} /></mesh>
          </group>
        ))}
        <ClickCatcher onPick={onPick} />
        {/* tape lines */}
        <mesh position={[0, 0, 0.32]}><planeGeometry args={[2, W]} /><meshBasicMaterial color="#ddffdc" transparent opacity={0.85} /></mesh>
        <mesh position={[-167.01, 0, 0.32]}><planeGeometry args={[2.5, W]} /><meshBasicMaterial color="#3b82f6" /></mesh>
        <mesh position={[167.01, 0, 0.32]}><planeGeometry args={[2.5, W]} /><meshBasicMaterial color="#ef4444" /></mesh>
        {/* HUBs */}
        <Hub x={-167.01} alliance="blue" label="BLUE HUB · 47×47 · ⌀41.7 @72" />
        <Hub x={167.01} alliance="red" label="RED HUB · 47×47 · ⌀41.7 @72" />
        {/* BUMPs */}
        <Bump x={-167.01} y={-70} color="#274bdb" />
        <Bump x={-167.01} y={70} color="#274bdb" />
        <Bump x={167.01} y={-70} color="#c03333" />
        <Bump x={167.01} y={70} color="#c03333" />
        <Label pos={[-167.01, -70, 14]} text="BUMP 73×44.4×6.5 · 15°" />
        {/* TRENCHes */}
        <Trench x={-167.01} y={-135.3} />
        <Trench x={-167.01} y={135.3} />
        <Trench x={167.01} y={-135.3} />
        <Trench x={167.01} y={135.3} />
        <Label pos={[-167.01, 135.3, 48]} text="TRENCH · clear 50.3×22.25" />
        {/* Towers */}
        <Tower x={-303} alliance="blue" />
        <Tower x={303} alliance="red" />
        {/* Depots / Outposts */}
        <Depot x={-311} y={100} label="BLUE DEPOT 42×27" />
        <Depot x={311} y={-100} label="RED DEPOT 42×27" />
        <Outpost x={-300} y={-140} label="BLUE OUTPOST · chute ~25" />
        <Outpost x={300} y={140} label="RED OUTPOST · chute ~25" />
        {/* AprilTags: hub faces + walls */}
        <AprilTag x={-190} y={0} z={44.25} />
        <AprilTag x={190} y={0} z={44.25} />
        <AprilTag x={-324} y={-40} z={21.75} />
        <AprilTag x={324} y={40} z={21.75} />
        <FuelPiles />
        <HeatLayer />
        <PathLine />
        {/* static origin marker (dim) + animated playthrough robot (lime ring) */}
        <mesh position={[s.origin.x, s.origin.y, 1.5]}>
          <sphereGeometry args={[2.2, 12, 12]} />
          <meshBasicMaterial color="#485346" />
        </mesh>
        {s.dest && <mesh position={[s.dest.x, s.dest.y, 1.5]}><sphereGeometry args={[2.4, 12, 12]} /><meshBasicMaterial color={LIME} /></mesh>}
        <Suspense fallback={null}>
          <PlaythroughRobot t={t} slot={0} />
        </Suspense>
        {s.allianceMode && (
          <Suspense fallback={null}>
            <PlaythroughRobot t={t} slot={1} />
          </Suspense>
        )}
        {s.allianceMode && (
          <Suspense fallback={null}>
            <PlaythroughRobot t={t} slot={2} />
          </Suspense>
        )}
        <Animator setT={setT} total={total} playing={playing} speed={speed} />
        {measure.a && measure.b && (
          <group>
            <lineSegments geometry={new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(measure.a.x, measure.a.y, 2), new THREE.Vector3(measure.b.x, measure.b.y, 2)])}>
              <lineBasicMaterial color={LIME} />
            </lineSegments>
          </group>
        )}
        <OrbitControls makeDefault target={[0, 0, 0]} enablePan enableRotate enableZoom minDistance={110} maxDistance={1300} maxPolarAngle={Math.PI / 2 - 0.03} />
      </Canvas>
      {/* camera presets — free orbit always on: drag = orbit, right-drag = pan, wheel = zoom */}
      <div className="absolute top-2 left-2 flex gap-1.5 text-xs flex-wrap max-w-[70%]">
        {[['persp', '3D'], ['top', 'Top'], ['side', 'Side'], ['end', 'End'], ['corner', 'Corner'], ['driverBlue', 'Blue DS'], ['driverRed', 'Red DS'], ['hub', 'HUB']].map(([id, label]) => (
          <button key={id} onClick={() => setCam(id)} className={`px-2.5 py-1 rounded-full border font-bold ${cam === id ? 'bg-[#7fee64] text-black border-[#7fee64]' : 'border-[#485346] text-[#859984] bg-black/60'}`}>{label}</button>
        ))}
        <span className="px-2 py-1 font-mono text-[#677d64] border border-[#1f2a33] rounded-full bg-black/60">({s.origin.x.toFixed(0)}, {s.origin.y.toFixed(0)}) in</span>
      </div>
      <PlaythroughControls t={t} setT={setT} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />
    </div>
  );
}
export function GLBPreloader() { return null; }
export function preloadGLB(_url: string) { return; }
