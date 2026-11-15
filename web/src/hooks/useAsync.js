import { useCallback, useEffect, useRef, useState } from 'react';

// { data, error, loading, reload }. Re-runs when deps change; ignores results from stale runs.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const run = useRef(0);
  const load = useCallback(
    async (silent = false) => {
      const id = ++run.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fn();
        if (id === run.current) setState({ data, error: null, loading: false });
      } catch (error) {
        if (id === run.current) setState((s) => ({ data: silent ? s.data : undefined, error, loading: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: () => load(true) };
}

export function usePolling(reload, ms) {
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) reload(); }, ms);
    return () => clearInterval(id);
  }, [reload, ms]);
}
