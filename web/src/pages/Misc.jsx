import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState, buttonStyles } from '../ui/primitives.jsx';
import { useAuth } from '../state/AuthContext.jsx';

// The API redirects here with #token=...; keeping it in the fragment keeps it out of server logs.
export function AuthCallback() {
  const { acceptToken } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    history.replaceState(null, '', location.pathname);
    (token ? acceptToken(token) : Promise.resolve()).finally(() => navigate('/welcome', { replace: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <p role="status" className="py-10 text-muted">Finishing sign-in…</p>;
}

export const NotFound = () => (
  <EmptyState title="Page not found" body="That page does not exist." action={<Link to="/" className={buttonStyles('primary')}>Back home</Link>} />
);
