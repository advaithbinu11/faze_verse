import { Suspense, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';

function GLBModel({ url }) {
  const { scene } = useGLTF(url); // Draco + meshopt are wired by drei; cached by URL
  return <primitive object={scene} />;
}

// Drop an optimised glTF at public/models/vault.glb and it replaces the procedural core.
// A HEAD request decides, so a missing file never triggers a failed Suspense load.
export function ModelSlot({ url = '/models/vault.glb', children }) {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(url, { method: 'HEAD' })
      .then((r) => live && setPresent(r.ok && !/html/.test(r.headers.get('content-type') ?? '')))
      .catch(() => {});
    return () => { live = false; };
  }, [url]);
  return present ? <Suspense fallback={children}><GLBModel url={url} /></Suspense> : children;
}
