import { useMemo } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { useApp } from '../store';

// Detailed + realistic single-team robot: procedural engineering model
// (chassis, 4x swerve, bumpers, intake, shooter hood, climber) with PBR
// materials. Optional user GLB import overrides procedural body.
export function DetailedRobot({ position, alliance }: { position: [number, number, number]; alliance: 'red' | 'blue' }) {
  const s = useApp();
  const robot = s.robot();
  const fp = robot.footprintIn ?? { x: 29, y: 29 };
  const bumper = alliance === 'red' ? '#b91c1c' : '#1d4ed8';

  const glb = s.glbUrl ? useGLTFZ(s.glbUrl) : null;

  return (
    <group position={position}>
      {glb ? (
        <Clone object={glb.scene} scale={1} position={[0, 0, 2]} />
      ) : (
        <group>
          {/* bumpers */}
          <mesh position={[0, 0, 5]} castShadow>
            <boxGeometry args={[fp.x + 6, fp.y + 6, 5]} />
            <meshStandardMaterial color={bumper} roughness={0.85} />
          </mesh>
          {/* chassis */}
          <mesh position={[0, 0, 9.5]} castShadow>
            <boxGeometry args={[fp.x, fp.y, 4]} />
            <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* top plate + electronics */}
          <mesh position={[0, 0, 12.4]} castShadow>
            <boxGeometry args={[fp.x - 4, fp.y - 4, 1.2]} />
            <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-fp.x / 4, 0, 14]}>
            <boxGeometry args={[8, 10, 2.4]} />
            <meshStandardMaterial color="#065f46" metalness={0.3} roughness={0.5} />
          </mesh>
          {/* 4x swerve modules */}
          {([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([sx, sy], i) => (
            <group key={i} position={[(sx * (fp.x / 2 - 4)), (sy * (fp.y / 2 - 4)), 2.6]}>
              <mesh castShadow><cylinderGeometry args={[2.1, 2.1, 3.4, 20]} /><meshStandardMaterial color="#0b0f0e" roughness={0.9} /></mesh>
              <mesh position={[0, 0, 2.6]}><boxGeometry args={[4.4, 4.4, 2]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} /></mesh>
            </group>
          ))}
          {/* intake rollers (front) */}
          <group position={[fp.x / 2 + 2, 0, 6]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.6, 1.6, fp.y - 8, 16]} /><meshStandardMaterial color="#D9A441" metalness={0.4} roughness={0.4} /></mesh>
            <mesh position={[0, 0, 3]}><boxGeometry args={[3, fp.y - 6, 1]} /><meshStandardMaterial color="#22c55e" metalness={0.2} roughness={0.6} /></mesh>
          </group>
          {/* shooter hood */}
          <group position={[-4, 0, 18]}>
            <mesh castShadow><boxGeometry args={[12, 12, 6]} /><meshStandardMaterial color="#14532d" metalness={0.5} roughness={0.45} /></mesh>
            <mesh position={[0, 0, 4.4]} rotation={[0, 0, 0.5]}><boxGeometry args={[9, 9, 1.4]} /><meshStandardMaterial color="#2BD96A" emissive="#052e16" emissiveIntensity={0.6} /></mesh>
          </group>
          {/* climber arms */}
          <group position={[-fp.x / 2 + 4, 0, 16]}>
            {[-6, 6].map((y, i) => (
              <mesh key={i} position={[0, y, 6]}><boxGeometry args={[1.6, 1.6, 12]} /><meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.25} /></mesh>
            ))}
          </group>
          {/* FUEL in hopper (instanced look via few spheres) */}
          <HopperFuel n={Math.min(8, Math.round((robot.storage ?? 14) / 2))} />
        </group>
      )}
      {/* team marker */}
      <mesh position={[0, 0, 30]}>
        <planeGeometry args={[20, 6]} />
        <meshBasicMaterial color={alliance === 'red' ? '#ef4444' : '#3b82f6'} />
      </mesh>
    </group>
  );
}

function HopperFuel({ n }: { n: number }) {
  const items = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: (i % 4) * 5 - 7.5, y: Math.floor(i / 4) * 5 - 2.5, z: 15 + (i % 2) * 3 })), [n]);
  return (
    <group>
      {items.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[2.9, 12, 12]} />
          <meshStandardMaterial color="#facc15" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function useGLTFZ(url: string) {
  try {
    const g = useGLTF(url);
    return g;
  } catch {
    return null;
  }
}
