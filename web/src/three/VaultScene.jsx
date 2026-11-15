import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useProgress, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SceneFrame, useScene } from './SceneFrame.jsx';
import { ModelSlot } from './ModelSlot.jsx';
import { backdrop, embers, logo } from './shaders.js';
import { LOGO_OUTLINE, LOGO_SVG_POINTS, LOGO_SVG_VIEWBOX, LOGO_ASPECT } from './fazeLogo.js';

const ACCENT = '#e4002b'; // brand Red Alert, mirrors --color-accent
const BASE = '#111111'; // brand Black, mirrors dark --color-bg

function Backdrop() {
  const { animate } = useScene();
  const aspect = useThree((s) => s.viewport.aspect);
  const mat = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 4 }, uAspect: { value: 1 }, uPointer: { value: new THREE.Vector2() },
    uBase: { value: new THREE.Color(BASE) }, uAccent: { value: new THREE.Color(ACCENT) },
  }), []);
  useFrame((state, dt) => {
    const u = mat.current.uniforms;
    u.uAspect.value = aspect;
    if (!animate) return;
    u.uTime.value += dt;
    u.uPointer.value.lerp(state.pointer, 1 - Math.exp(-dt * 3));
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} uniforms={uniforms} depthWrite={false} depthTest={false} {...backdrop} />
    </mesh>
  );
}

// The FaZe mark, extruded from its traced outline (unit height; the group scales it to fit the canvas).
function useLogoGeometry() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(LOGO_OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -0.09); // centre the depth on the origin so it turns about its middle
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function Core() {
  const { animate } = useScene();
  const noise = useTexture('/textures/noise.png'); // scalar data: keeps NoColorSpace
  const { active, progress } = useProgress();
  const viewport = useThree((s) => s.viewport);
  const geometry = useLogoGeometry();
  const mat = useRef();
  const group = useRef();
  const pulse = useRef(0);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;

  const uniforms = useMemo(() => ({
    uTime: { value: 4 }, uProgress: { value: animate ? 0 : 1 }, uPulse: { value: 0 },
    uAccent: { value: new THREE.Color(ACCENT) }, uNoise: { value: noise },
  }), [noise, animate]);

  // Wide heroes: a large mark right of centre, so the headline stays clear. Narrow ones (phones, portrait tablets): a small mark
  // in the empty top-right corner, because a bright white shape behind the headline would make it unreadable.
  const wide = viewport.aspect > 1.8;
  const size = wide ? Math.min(2.7, viewport.height * 0.58, (viewport.width * 0.4) / LOGO_ASPECT) : (viewport.width * 0.34) / LOGO_ASPECT;
  const homeX = wide ? viewport.width * 0.2 : viewport.width * 0.45 - (size * LOGO_ASPECT) / 2;
  const homeY = wide ? 0 : viewport.height * 0.5 - size * 0.5 - viewport.height * 0.09;

  useFrame((state, dt) => {
    const u = mat.current.uniforms;
    if (!animate) { group.current.rotation.set(0.06, -0.22, 0); group.current.position.x = homeX; return; }
    u.uTime.value += dt;
    // Reveal tracks real asset progress, then completes: the dissolve IS the loading state.
    const target = active ? Math.min(0.6, progress / 100) : 1;
    u.uProgress.value = THREE.MathUtils.damp(u.uProgress.value, target, 1.6, dt);
    pulse.current = THREE.MathUtils.damp(pulse.current, 0, 2.2, dt);
    u.uPulse.value = pulse.current;
    // The mark sways to follow the pointer instead of spinning, so its face stays readable.
    const t = u.uTime.value;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, Math.sin(t * 0.5) * 0.3 + state.pointer.x * 0.5, 3, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0.06 - state.pointer.y * 0.3, 3, dt);
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, homeX + state.pointer.x * 0.2, 3, dt);
  });

  return (
    <group ref={group} position={[homeX, homeY, 0]} scale={size} onPointerDown={() => { pulse.current = 1; }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <ModelSlot>
        <mesh geometry={geometry}>
          <shaderMaterial ref={mat} uniforms={uniforms} {...logo} />
        </mesh>
      </ModelSlot>
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1, 0.005, 8, 160]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function Embers({ count }) {
  const { animate } = useScene();
  const dpr = useThree((s) => s.viewport.dpr);
  const mat = useRef();
  const { geometry, uniforms } = useMemo(() => {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 9, 0, (Math.random() - 0.5) * 4 - 0.5], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return { geometry: g, uniforms: { uTime: { value: 4 }, uSize: { value: 14 }, uPixelRatio: { value: 1 }, uAccent: { value: new THREE.Color(ACCENT) } } };
  }, [count]);
  useFrame((_, dt) => {
    mat.current.uniforms.uPixelRatio.value = dpr;
    if (animate) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} {...embers} />
    </points>
  );
}

// Shown when WebGL is unavailable: the same traced mark as flat SVG over the brand slash.
const Poster = () => (
  <div aria-hidden="true" className="relative h-full w-full bg-bg" style={{ background: 'linear-gradient(115deg, var(--color-bg) 55%, var(--color-accent) 55%, var(--color-accent) 64%, var(--color-bg) 64%)' }}>
    <svg viewBox={LOGO_SVG_VIEWBOX} className="absolute right-[12%] top-1/2 h-[46%] -translate-y-1/2" fill="#f5f5f5">
      <polygon points={LOGO_SVG_POINTS} />
    </svg>
  </div>
);

export default function VaultScene({ className }) {
  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  return (
    <SceneFrame className={className} camera={{ position: [0, 0, 6], fov: 45 }} fallback={<Poster />} label="Animated 3D FaZe Clan logo">
      <Backdrop />
      <Suspense fallback={null}>
        <Core />
      </Suspense>
      <Embers count={small ? 350 : 900} />
    </SceneFrame>
  );
}
