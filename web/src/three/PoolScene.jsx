import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneFrame, useScene } from './SceneFrame.jsx';
import { bar } from './shaders.js';

const MAX_H = 2.6;
const MIN_H = 0.25;

function Bar({ x, color, share }) {
  const { animate } = useScene();
  const mesh = useRef();
  const mat = useRef();
  const h = useRef(MIN_H);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uHeight: { value: MIN_H }, uEmphasis: { value: 0.5 }, uColor: { value: new THREE.Color(color) },
  }), [color]);

  useFrame((_, dt) => {
    const target = MIN_H + MAX_H * share.current;
    h.current = animate ? THREE.MathUtils.damp(h.current, target, 3, dt) : target;
    mesh.current.scale.y = h.current;
    mesh.current.position.y = h.current / 2;
    const u = mat.current.uniforms;
    u.uHeight.value = h.current;
    u.uEmphasis.value = share.current;
    if (animate) u.uTime.value += dt;
  });

  return (
    <mesh ref={mesh} position={[x, MIN_H / 2, 0]}>
      <boxGeometry args={[1.1, 1, 1.1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} {...bar} />
    </mesh>
  );
}

function Rig({ shareA, shareB }) {
  const { animate } = useScene();
  const group = useRef();
  useFrame((state, dt) => {
    if (!animate) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.5 + state.pointer.x * 0.35, 3, dt);
  });
  return (
    <group ref={group} position={[0, -1.4, 0]} rotation={[0, -0.5, 0]}>
      <Bar x={-0.95} color="#e4002b" share={shareA} />
      <Bar x={0.95} color="#ffffff" share={shareB} />
      <gridHelper args={[6, 12, '#444444', '#2a2a2a']} />
    </group>
  );
}

const Fallback = () => <div aria-hidden="true" className="h-full w-full bg-surface" />;

// shareA / shareB are 0..1 pool fractions held in refs so polling updates never re-render the Canvas.
export default function PoolScene({ shareA, shareB, className, label }) {
  return (
    <SceneFrame className={className} camera={{ position: [0, 1.2, 6.5], fov: 38 }} fallback={<Fallback />} label={label}>
      <color attach="background" args={['#111111']} />
      <Rig shareA={shareA} shareB={shareB} />
    </SceneFrame>
  );
}
