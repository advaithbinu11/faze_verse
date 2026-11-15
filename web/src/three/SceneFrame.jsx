import { Component, createContext, useContext, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { hasWebGL, useReducedMotion } from '../hooks/useEnv.js';

const SceneContext = createContext({ animate: true });
export const useScene = () => useContext(SceneContext);

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[scene]', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// Wraps a Canvas with everything a production scene needs: WebGL detection, an error boundary,
// reduced-motion handling, pausing while off-screen, and adaptive resolution.
export function SceneFrame({ children, fallback, className, camera, label }) {
  const reduced = useReducedMotion();
  const box = useRef(null);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState([1, 1.75]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const ok = hasWebGL();
  return (
    <div ref={box} className={className} role="img" aria-label={label}>
      {ok ? (
        <Boundary fallback={fallback}>
          <Canvas
            flat
            dpr={dpr}
            frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
            camera={camera}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            aria-hidden="true"
          >
            <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr([1, 1.75])} />
            <SceneContext.Provider value={{ animate: !reduced }}>{children}</SceneContext.Provider>
          </Canvas>
        </Boundary>
      ) : fallback}
    </div>
  );
}
