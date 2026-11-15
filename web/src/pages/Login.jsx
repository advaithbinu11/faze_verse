import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button, Field, buttonStyles, errorMessage, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAuth } from '../state/AuthContext.jsx';

export default function Login() {
  const { user, login, acceptToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/welcome" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setError(''); setBusy(true);
    try {
      const { token } = await api.login({ email: email.trim().toLowerCase(), password });
      await acceptToken(token);
      navigate('/welcome', { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-feed">
      <h1 className="mb-5 text-xl">Sign in</h1>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {error && <p role="alert" className="rounded-md bg-surface p-3 font-semibold text-danger">{error}</p>}
        <Field id="li-email" label="Email"><input id="li-email" className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field id="li-password" label="Password"><input id="li-password" className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" type="submit" loading={busy}>Sign in</Button>
          <Link to="/signup" className="text-sm font-bold text-accent-text underline">Create an account</Link>
        </div>
        <div className="border-t border-border pt-4"><button type="button" onClick={login} className={buttonStyles('secondary')}>Continue with Steam</button></div>
      </form>
    </div>
  );
}
