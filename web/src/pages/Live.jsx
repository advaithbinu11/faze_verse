import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button, EmptyState, ErrorState, Field, Pill, Skeleton, errorMessage, inputClass } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync, usePolling } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import { WatchCard } from './WatchCard.jsx';
import { TwitchWatch } from './TwitchWatch.jsx';

const PoolScene = lazy(() => import('../three/PoolScene.jsx'));
const fmt = (n) => n.toLocaleString();
const odds = (total, side) => (side ? `${(total / side).toFixed(2)}x` : 'n/a');

function PredictionPanel({ event }) {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const mine = useAsync(() => (user ? api.getMyPrediction(event.event_id) : null), [event.event_id, user?._id]);
  const [team, setTeam] = useState('team_a');
  const [points, setPoints] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (status === 'anonymous') {
    return <EmptyState title="Sign in to predict" body="Link your Steam account to get a points balance and lock in a call." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} />;
  }
  if (mine.loading) return <Skeleton className="h-40" />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.reload} />;

  if (mine.data) {
    const p = mine.data;
    const pool = event[`${p.team}_points`];
    return (
      <div className="rounded-md bg-surface p-3.5" role="status">
        <div className="label">Your call</div>
        <p className="mt-1 text-base">You put <b>{fmt(p.points)}</b> points on <b>{event[p.team]}</b>.</p>
        {p.status === 'pending' && pool > 0 && (
          <p className="text-sm text-muted">At the current pool you would collect about {fmt(Math.floor((p.points * event.total_points_invested) / pool))} points if they win.</p>
        )}
        {p.status !== 'pending' && <p className="text-sm text-muted">Result: {p.status}{p.payout ? `, paid ${fmt(p.payout)}` : ''}.</p>}
      </div>
    );
  }

  if (event.status !== 'upcoming') {
    return <EmptyState title="Calls are closed" body="This match has started, so the pool is locked. Come back for the next one." />;
  }

  const n = Number(points);
  const max = Math.min(user?.faze_points ?? 0, 100000);
  const submit = async (e) => {
    e.preventDefault();
    if (!Number.isInteger(n) || n < 1) return setError('Enter a whole number of points, 1 or more.');
    if (n > max) return setError(`You can stake up to ${fmt(max)} points.`);
    setError(''); setBusy(true);
    try {
      await api.placePrediction(event.event_id, { team, points: n });
      toast(`Locked in ${fmt(n)} points on ${event[team]}.`);
      await Promise.all([mine.reload(), refresh()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md bg-surface p-3.5" noValidate>
      <div role="group" aria-labelledby="pick-l" className="grid gap-1.5">
        <span id="pick-l" className="text-[13px] font-semibold">Who takes it?</span>
        <div className="flex flex-wrap gap-2">
          <Pill pressed={team === 'team_a'} onClick={() => setTeam('team_a')}>{event.team_a}</Pill>
          <Pill pressed={team === 'team_b'} onClick={() => setTeam('team_b')}>{event.team_b}</Pill>
        </div>
      </div>
      <Field id="stake" label={`Points to stake (you have ${fmt(user.faze_points)})`} error={error}>
        <input id="stake" className={`${inputClass} max-w-[200px]`} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'stake-err' : undefined} />
      </Field>
      <div><Button variant="primary" type="submit" loading={busy}>Lock in</Button></div>
    </form>
  );
}

function Matches() {
  const events = useAsync(() => api.listEvents(), []);
  usePolling(events.reload, 5000);
  const updates = useAsync(() => api.listUpdates(), []);
  const [picked, setPicked] = useState(null);
  const shareA = useRef(0.5);
  const shareB = useRef(0.5);

  const open = (events.data ?? []).filter((e) => e.status === 'live' || e.status === 'upcoming');
  const ev = open.find((e) => e.event_id === picked) ?? open[0];
  useEffect(() => {
    if (!ev) return;
    const t = ev.total_points_invested || 1;
    shareA.current = ev.total_points_invested ? ev.team_a_points / t : 0.5;
    shareB.current = ev.total_points_invested ? ev.team_b_points / t : 0.5;
  }, [ev]);

  if (events.loading) return <div className="grid gap-4"><Skeleton className="h-72" /><Skeleton className="h-40" /></div>;
  if (events.error) return <ErrorState error={events.error} onRetry={events.reload} />;
  if (!ev) return <EmptyState title="No matches right now" body="When the next match is scheduled it will show up here with its prediction pool." />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section aria-labelledby="match-h" className="grid content-start gap-4">
        {open.length > 1 && (
          <div role="group" aria-label="Choose a match" className="flex flex-wrap gap-2">
            {open.map((e) => <Pill key={e.event_id} pressed={e.event_id === ev.event_id} onClick={() => setPicked(e.event_id)}>{e.team_a} vs {e.team_b}</Pill>)}
          </div>
        )}
        <div>
          <div className="label">{ev.status === 'live' ? 'Live now' : `Starts ${new Date(ev.start_time).toLocaleString()}`} · {ev.game_name}</div>
          <h2 id="match-h" className="text-xl">{ev.team_a} vs {ev.team_b}</h2>
          <p className="text-body-sm text-muted">{ev.title}</p>
        </div>

        <Suspense fallback={<Skeleton className="h-72" />}>
          <PoolScene shareA={shareA} shareB={shareB} className="aspect-[16/10] w-full overflow-hidden rounded-md bg-black" label={`Prediction pools: ${ev.team_a} ${fmt(ev.team_a_points)} points, ${ev.team_b} ${fmt(ev.team_b_points)} points`} />
        </Suspense>

        <dl className="m-0 grid grid-cols-3 gap-3 text-sm" aria-label="Pool breakdown">
          <div><dt className="label">{ev.team_a}</dt><dd className="m-0 font-bold">{fmt(ev.team_a_points)} pts · {odds(ev.total_points_invested, ev.team_a_points)}</dd></div>
          <div><dt className="label">{ev.team_b}</dt><dd className="m-0 font-bold">{fmt(ev.team_b_points)} pts · {odds(ev.total_points_invested, ev.team_b_points)}</dd></div>
          <div><dt className="label">Total pool</dt><dd className="m-0 font-bold">{fmt(ev.total_points_invested)} pts</dd></div>
        </dl>

        <PredictionPanel key={ev.event_id} event={ev} />
      </section>

      <div className="grid content-start gap-8">
        <WatchCard />
        <section aria-labelledby="upd-h">
          <h2 id="upd-h" className="text-lg">Match updates</h2>
          <p className="mb-3 text-body-sm text-muted">Round results as they land.</p>
          {updates.loading ? <Skeleton className="h-24" /> : (
            <ul className="m-0 list-none p-0" aria-live="polite">
              {(updates.data ?? []).map((u) => (
                <li key={u.round} className="border-t border-border py-2 text-body-sm"><b className="mr-1.5 text-accent-text">R{u.round}</b>{u.text}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Live() {
  return (
    <div className="grid gap-14">
      <TwitchWatch />
      <Matches />
    </div>
  );
}
