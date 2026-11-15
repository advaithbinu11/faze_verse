import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Avatar, Button, Chip, EmptyState, ErrorState, Skeleton, buttonStyles, errorMessage } from '../ui/primitives.jsx';
import { FriendRow, OnlineStatus } from '../ui/people.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

// Another player's page: the same layout as your own Welcome page, filled with their data.
export default function Member() {
  const { userId } = useParams();
  const { user, status, login } = useAuth();
  const toast = useToast();
  const profile = useAsync(() => (user ? api.getProfile(userId) : null), [userId, user?._id]);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <Skeleton className="h-64" />;
  if (!user) {
    return <EmptyState title="Sign in to see this player" body="Player pages are for signed-in members." action={<button type="button" onClick={login} className={buttonStyles('primary')}>Sign in with Steam</button>} />;
  }
  if (userId === user._id || profile.data?.is_self) return <Navigate to="/welcome" replace />;
  if (profile.error) {
    return profile.error.status === 404
      ? <EmptyState title="Player not found" body="That player does not exist or was removed." action={<Link to="/welcome" className={buttonStyles('primary')}>Back to your page</Link>} />
      : <ErrorState error={profile.error} onRetry={profile.reload} />;
  }
  // No data yet also covers the render between the user arriving and the fetch starting, when loading is still false.
  if (profile.loading || !profile.data) return <Skeleton className="h-64" />;

  const p = profile.data;
  const onlineFriends = p.friends.filter((f) => f.online).length;
  const inCommon = [...p.shared_games, ...p.shared_teams];

  const addFriend = async () => {
    setBusy(true);
    try {
      await api.addFriend(p.id);
      toast(`Added ${p.name} as a friend.`);
      await profile.reload();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-10">
      <div>
        {/* The display font paints above its line box, so the link is lifted above the heading and is a full-size tap target. */}
        <Link to="/welcome" className="relative z-10 inline-flex min-h-[40px] items-center text-sm font-bold text-accent-text underline">Back to your page</Link>
        <h1 className="text-display break-words">{p.name}</h1>
      </div>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <section aria-labelledby="who-h" className="frame grid place-items-center gap-4 p-8 text-center">
          <Avatar name={p.name} size={140} color={p.profile_color ?? undefined} logo={p.profile_logo} />
          <div className="min-w-0">
            <h2 id="who-h" className="break-words text-xl">{p.name}</h2>
            <p className="text-body-sm text-muted">{p.faze_points.toLocaleString()} points</p>
            <div className="mt-1 flex justify-center"><OnlineStatus online={p.online} /></div>
          </div>
          {p.teams_followed.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0" aria-label="Teams followed">
              {p.teams_followed.map((t) => <li key={t}><Chip>{t}</Chip></li>)}
            </ul>
          )}
          {p.is_friend
            ? <p role="status" className="inline-flex items-center gap-2 font-bold text-success"><span aria-hidden="true">✓</span> You are friends</p>
            : <Button variant="primary" loading={busy} onClick={addFriend}>Add friend</Button>}
        </section>

        <section aria-labelledby="fr-h" className="rounded-lg border-2 border-text p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="fr-h" className="text-xl">Friends</h2>
            {p.friends.length > 0 && <span className="text-sm text-muted">{onlineFriends} online</span>}
          </div>
          {!p.friends.length
            ? <EmptyState title="No friends yet" body={`${p.name} has not added anyone yet.`} />
            : <ul className="m-0 list-none p-0">{p.friends.map((f) => <FriendRow key={f.id} friend={f} to={f.id === user._id ? '/welcome' : undefined} />)}</ul>}
        </section>
      </div>

      <section aria-labelledby="common-h" className="rounded-lg bg-surface p-6 sm:p-8">
        <span className="label">You and {p.name}</span>
        <h2 id="common-h" className="text-xl sm:text-[40px] sm:leading-[44px]">In common</h2>
        {inCommon.length > 0
          ? <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">{inCommon.map((x) => <li key={x}><Chip>{x}</Chip></li>)}</ul>
          : <p className="mt-2 text-body-sm text-muted">No shared games or teams yet.</p>}
        {p.games.length > 0 && (
          <>
            <h3 className="mt-6 text-lg">Games</h3>
            <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
              {p.games.map((g) => <li key={g.name}><Chip on={p.shared_games.includes(g.name)}>{g.name}{g.hours != null && <span className="font-normal text-muted"> · {Math.round(g.hours)} h</span>}</Chip></li>)}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
