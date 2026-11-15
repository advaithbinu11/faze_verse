import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, LIVE, loginUrl, tokenStore } from '../data/index.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | anonymous | ready

  const refresh = useCallback(async () => {
    if (LIVE && !tokenStore.get()) { setUser(null); setStatus('anonymous'); return; }
    try {
      setUser(await api.getMe());
      setStatus('ready');
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    user, status, refresh, demo: !LIVE,
    login: () => { window.location.href = loginUrl(); },
    logout: () => { tokenStore.clear(); setUser(null); setStatus('anonymous'); },
    acceptToken: (t) => { tokenStore.set(t); return refresh(); },
  }), [user, status, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
