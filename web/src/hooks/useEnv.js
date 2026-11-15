import { useEffect, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

let webgl;
export function hasWebGL() {
  if (webgl === undefined) {
    try {
      webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
