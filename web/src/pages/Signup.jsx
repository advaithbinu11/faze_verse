import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button, Field, Pill, buttonStyles, errorMessage, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAuth } from '../state/AuthContext.jsx';
import { MAX_FAVORITES, PLAYER_GROUPS, PLAYER_PATTERN } from '../data/players.js';
import { randomColor } from '../data/colors.js';
import { ColorPicker } from '../ui/ColorPicker.jsx';

const STEAM_ID = /^7656119\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Use at least 2 characters.';
  else if (v.name.trim().length > 30) e.name = 'Use 30 characters or fewer.';
  if (!EMAIL.test(v.email.trim())) e.email = 'Enter a valid email address.';
  if (v.password.length < 10) e.password = 'Use at least 10 characters.';
  else if (v.password.length > 128) e.password = 'Use 128 characters or fewer.';
  if (v.steam_id.trim() && !STEAM_ID.test(v.steam_id.trim())) e.steam_id = 'Enter the 17-digit Steam ID. It starts with 7656119.';
  return e;
}

export default function Signup() {
  const { user, login, acceptToken } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ name: '', email: '', password: '', steam_id: '' });
  const [color, setColor] = useState(randomColor); // a random starting pick; change it or keep it
  const [players, setPlayers] = useState([]);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/welcome" replace />;

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const full = players.length >= MAX_FAVORITES;
  const toggle = (name) => setPlayers((l) => (l.includes(name) ? l.filter((x) => x !== name) : l.length < MAX_FAVORITES ? [...l, name] : l));
  const known = new Set(PLAYER_GROUPS.flatMap((g) => g.players));

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (!PLAYER_PATTERN.test(name)) return setCustomError('Use letters, numbers, spaces, . _ - (30 max).');
    if (players.some((p) => p.toLowerCase() === name.toLowerCase())) return setCustomError('Already in your list.');
    if (full) return setCustomError(`You can pick up to ${MAX_FAVORITES}.`);
    setPlayers((l) => [...l, name]); setCustom(''); setCustomError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(v);
    setErrors(found); setFormError('');
    if (Object.keys(found).length) return document.getElementById(`su-${Object.keys(found)[0]}`)?.focus();
    setBusy(true);
    try {
      const { token } = await api.signup({ name: v.name.trim(), email: v.email.trim().toLowerCase(), password: v.password, steam_id: v.steam_id.trim(), favorite_players: players, profile_color: color });
      await acceptToken(token);
      navigate('/welcome', { replace: true });
    } catch (err) {
      const fe = err.details?.fieldErrors ?? {};
      const mapped = Object.fromEntries(Object.entries(fe).map(([k, m]) => [k, m[0]]));
      setErrors(mapped);
      setFormError(Object.keys(mapped).length ? 'Fix the highlighted fields and try again.' : errorMessage(err));
    } finally { setBusy(false); }
  };

  const bind = (k) => ({ id: `su-${k}`, value: v[k], onChange: set(k), 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `su-${k}-err` : undefined });

  return (
    <div className="max-w-feed">
      <h1 className="text-xl">Create your account</h1>
      <p className="mb-5 text-body-sm text-muted">You start with welcome points. Points have no cash value.</p>

      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <p role="alert" className="rounded-md bg-surface p-3 font-semibold text-danger">{formError}</p>}

        <Field id="su-name" label="Display name" error={errors.name}>
          <input {...bind('name')} className={inputClass} autoComplete="nickname" maxLength={30} required />
        </Field>
        <Field id="su-email" label="Email" error={errors.email}>
          <input {...bind('email')} className={inputClass} type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field id="su-password" label="Password (10+ characters)" error={errors.password}>
          <div className="flex gap-2">
            <input {...bind('password')} className={inputClass} type={showPw ? 'text' : 'password'} autoComplete="new-password" required />
            <Button aria-pressed={showPw} onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</Button>
          </div>
        </Field>
        <Field id="su-steam_id" label="Steam ID (optional)" error={errors.steam_id}>
          <input {...bind('steam_id')} className={inputClass} inputMode="numeric" autoComplete="off" placeholder="7656119…" maxLength={17} />
          <span className="font-normal text-muted">Your 17-digit SteamID64. We save it as unverified until you sign in with Steam, so nobody can claim someone else’s.</span>
        </Field>

        <ColorPicker value={color} onChange={setColor} name={v.name.trim()} error={errors.profile_color} />

        <fieldset className="m-0 border-0 p-0" aria-describedby="fp-help">
          <legend className="text-[13px] font-semibold">Favorite FaZe players</legend>
          <p id="fp-help" className="mb-3 text-sm text-muted" aria-live="polite">Pick up to {MAX_FAVORITES}. {players.length} chosen.</p>
          <div className="grid gap-4">
            {PLAYER_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="label mb-2">{g.label}</div>
                <div className="flex flex-wrap gap-2">
                  {g.players.map((p) => <Pill key={p} pressed={players.includes(p)} disabled={full && !players.includes(p)} onClick={() => toggle(p)}>{p}</Pill>)}
                </div>
              </div>
            ))}
            {players.filter((p) => !known.has(p)).length > 0 && (
              <div>
                <div className="label mb-2">Your additions</div>
                <div className="flex flex-wrap gap-2">
                  {players.filter((p) => !known.has(p)).map((p) => <Pill key={p} pressed onClick={() => toggle(p)}>{p}</Pill>)}
                </div>
              </div>
            )}
            <Field id="su-custom" label="Someone else?" error={customError}>
              <div className="flex gap-2">
                <input id="su-custom" className={inputClass} value={custom} maxLength={30} aria-invalid={Boolean(customError)} aria-describedby={customError ? 'su-custom-err' : undefined}
                  onChange={(e) => { setCustom(e.target.value); setCustomError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
                <Button onClick={addCustom}>Add</Button>
              </div>
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" type="submit" loading={busy}>Create account</Button>
          <Link to="/login" className="text-sm font-bold text-accent-text underline">I already have an account</Link>
        </div>
        <div className="border-t border-border pt-4">
          <button type="button" onClick={login} className={buttonStyles('secondary')}>Continue with Steam instead</button>
        </div>
      </form>
    </div>
  );
}
