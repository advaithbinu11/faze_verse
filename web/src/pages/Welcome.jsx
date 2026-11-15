import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Button, Chip, EmptyState, ErrorState, Skeleton, buttonStyles } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { DiscordLinkBanner } from '../ui/DiscordLink.jsx';
import { FriendRow, OnlineStatus, personRow } from '../ui/people.jsx';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A fun fact from the FaZe history, picked from what the player follows and plays. Hidden if it cannot be loaded:
// it is a nicety, not something worth an error banner on the welcome page.
function FunFact() {
  const fact = useAsync(() => (api.getFunFact ? api.getFunFact() : null), []);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const current = next ?? fact.data;
  if (!api.getFunFact || fact.error || (!fact.loading && !current)) return null;
  const another = async () => {
    setBusy(true);
    try { setNext(await api.newFunFact()); } catch { /* keep the current fact */ } finally { setBusy(false); }
  };
  return (
    <section aria-labelledby="ff-h" className="frame grid gap-2 p-5">
      <span id="ff-h" className="label">Did you know?{current?.angle ? ` · ${current.angle}` : ''}</span>
      {fact.loading ? (
        <div aria-busy="true" className="grid gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
      ) : (
        <p className="m-0 max-w-[68ch] text-body" aria-live="polite">{current.fact}</p>
      )}
      {!fact.loading && <div><Button type="button" onClick={another} loading={busy}>Another one</Button></div>}
    </section>
  );
}

// Who the player follows, shown under their avatar: streamers/players first, then teams.
function FollowBadges({ teams = [], players = [] }) {
  if (!teams.length && !players.length) return <p className="m-0 text-sm text-muted">Not following anyone yet. Add streamers in your profile.</p>;
  return (
    <ul aria-label="Following" className="m-0 flex max-w-full list-none flex-wrap justify-center gap-1.5 p-0">
      {players.map((p) => <li key={`p-${p}`}><Chip accent>{p}</Chip></li>)}
      {teams.map((t) => <li key={`t-${t}`}><Chip>{t}</Chip></li>)}
    </ul>
  );
}

function SuggestionRow({ match }) {
  const shared = [plural(match.shared_games.length, 'game'), match.shared_teams.length ? plural(match.shared_teams.length, 'team') : null].filter(Boolean).join(' · ');
  return (
    <li>
      <Link to={`/u/${match.user_id}`} className={personRow}>
        <Avatar name={match.user_name} size={44} color={match.profile_color ?? undefined} />
        <div className="min-w-0 grow">
          <div className="truncate font-bold">{match.user_name}</div>
          <div className="truncate text-sm text-muted">{shared} in common: {[...match.shared_games, ...match.shared_teams].join(', ')}</div>
        </div>
        <OnlineStatus online={match.online} />
      </Link>
    </li>
  );
}

export default function Welcome() {
  const { user, status, login } = useAuth();
  // Friends are looked up by the signed-in user's id.
  const friends = useAsync(() => (user ? api.getFriends(user._id) : []), [user?._id]);
  const similar = useAsync(() => (user ? api.getSimilar(user._id, 5) : { matches: [] }), [user?._id]);

  if (status === 'loading') return <Skeleton className="h-64" />;
  if (!user) {
    return <EmptyState title="Sign in to see your page" body="Your friends and matches show up here once you're signed in." action={<button type="button" onClick={login} className={buttonStyles('primary')}>Sign in with Steam</button>} />;
  }

  const online = (friends.data ?? []).filter((f) => f.online).length;

  return (
    <div className="grid gap-10">
      <h1 className="text-display break-words">Welcome, {user.name}!</h1>
      <DiscordLinkBanner />
      <FunFact />

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <section aria-labelledby="me-h" className="frame grid place-items-center gap-4 p-8 text-center">
          <Avatar name={user.name} size={140} color={user.profile_color} logo={user.profile_logo} />
          <div className="min-w-0">
            <h2 id="me-h" className="break-words text-xl">{user.name}</h2>
            <p className="text-body-sm text-muted">{user.faze_points.toLocaleString()} points</p>
          </div>
          <FollowBadges teams={user.teams_followed} players={user.favorite_players} />
          <Link to="/profile" className={buttonStyles()}>Edit profile</Link>
        </section>

        <section aria-labelledby="fr-h" className="rounded-lg border-2 border-text p-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="fr-h" className="text-xl">Friends</h2>
            {friends.data?.length > 0 && <span className="text-sm text-muted">{online} online</span>}
          </div>
          {friends.loading ? (
            <div className="grid gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><Skeleton className="h-4 grow" /></div>)}
            </div>
          ) : friends.error ? (
            <ErrorState error={friends.error} onRetry={friends.reload} />
          ) : !friends.data.length ? (
            <EmptyState title="No friends yet" body="Meet some players below and they'll show up here." />
          ) : (
            <ul className="m-0 list-none p-0">{friends.data.map((f) => <FriendRow key={f.id} friend={f} />)}</ul>
          )}
        </section>
      </div>

      <section aria-labelledby="meet-h" className="rounded-lg bg-surface p-6 sm:p-8">
        <span className="label">Find your squad</span>
        <h2 id="meet-h" className="text-xl sm:text-[40px] sm:leading-[44px]">Meet new people</h2>
        <p className="mt-2 max-w-[52ch] text-body-sm text-muted">We match you with players who own the same games and follow the same teams.</p>

        <div className="mt-4" aria-live="polite">
          {similar.loading ? (
            <div className="grid gap-3" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><Skeleton className="h-4 grow" /></div>)}
            </div>
          ) : similar.error ? (
            <ErrorState error={similar.error} onRetry={similar.reload} />
          ) : !similar.data.matches.length ? (
            <p className="text-body-sm text-muted">No matches yet. Sign in with Steam so we can see your games, and follow a team in your profile.</p>
          ) : (
            <ul className="m-0 list-none p-0">{similar.data.matches.map((m) => <SuggestionRow key={m.user_id} match={m} />)}</ul>
          )}
        </div>

        <Link to="/party" className={`${buttonStyles('primary')} mt-4`}>Find players</Link>
      </section>
    </div>
  );
}
