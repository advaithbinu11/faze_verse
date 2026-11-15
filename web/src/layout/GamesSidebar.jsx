import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Skeleton } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync, usePolling } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';

const OFFLINE_SHOWN = 2; // online friends always show; offline ones are capped so one busy game cannot take over the list

function FriendLink({ f }) {
  return (
    <Link to={`/u/${f.id}`} className={`flex min-h-[32px] items-center gap-2 py-0.5 text-sm no-underline hover:underline [@media(pointer:coarse)]:min-h-[44px] ${f.online ? 'font-semibold' : 'text-muted'}`}>
      <Avatar name={f.name} size={24} color={f.profile_color ?? undefined} />
      <span className="min-w-0 grow truncate">{f.name}</span>
      <span className={`inline-flex flex-none items-center gap-1.5 text-xs ${f.online ? 'text-success' : ''}`}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${f.online ? 'bg-success' : 'border-2 border-border-input'}`} />
        {f.online ? 'Online' : 'Offline'}
      </span>
    </Link>
  );
}

function GameBlock({ game, friends, mine }) {
  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);
  const shown = [...online, ...offline.slice(0, OFFLINE_SHOWN)];
  const hidden = offline.length - OFFLINE_SHOWN;
  return (
    <li className="border-t border-border py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 min-w-0 truncate text-base font-bold">
          <Link to={`/party?game=${encodeURIComponent(game)}`} className="inline-flex min-h-[32px] items-center no-underline hover:underline [@media(pointer:coarse)]:min-h-[44px]">{game}</Link>
        </h3>
        {mine && <span className="flex-none text-xs font-semibold text-muted">You own this</span>}
      </div>
      {friends.length === 0 ? (
        <p className="m-0 mt-1 text-sm text-muted">No friends play this yet.</p>
      ) : (
        <>
          <p className="m-0 mt-0.5 text-sm text-muted">{friends.length} friend{friends.length === 1 ? '' : 's'}{online.length ? ` · ${online.length} online` : ''}</p>
          <ul className="m-0 mt-1.5 grid list-none gap-0.5 p-0">
            {shown.map((f) => <li key={f.id}><FriendLink f={f} /></li>)}
          </ul>
          {hidden > 0 && <p className="m-0 mt-1 text-xs text-muted">+{hidden} more offline</p>}
        </>
      )}
    </li>
  );
}

// Left-hand list of every game with the friends who play it; each game opens Party up filtered to it.
// On narrow screens it sits behind a toggle so it does not push the page content below the fold.
export default function GamesSidebar({ collapsed = false, onToggle }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const games = useAsync(() => (user && api.getFriendGames ? api.getFriendGames() : []), [user?._id]);
  usePolling(games.reload, 60_000);
  if (!user || !api.getFriendGames) return null;
  return (
    <aside aria-labelledby="games-h" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <h2 id="games-h" className="m-0 text-base font-bold lg:mb-1">
        {/* Narrow screens: the heading opens and closes the list. */}
        <button type="button" aria-expanded={open} aria-controls="games-list" onClick={() => setOpen(!open)}
          className="flex min-h-[44px] w-full items-center justify-between border-b border-border text-left font-bold lg:hidden">
          Games and friends playing
          <span aria-hidden="true" className="text-sm text-muted">{open ? 'Hide' : 'Show'}</span>
        </button>
        {/* Large screens: the sidebar is its own toggle. Click to expand it, click again to collapse it to a rail. */}
        <button type="button" aria-expanded={!collapsed} aria-controls="games-list" onClick={onToggle}
          className="hidden min-h-[32px] w-full items-center gap-2 rounded-sm border-0 bg-transparent p-1 text-left font-bold text-text hover:bg-surface lg:flex [@media(pointer:coarse)]:min-h-[44px]">
          <svg aria-hidden="true" viewBox="0 0 20 16" width="20" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none">
            <rect x="1" y="1" width="18" height="14" rx="1.5" />
            <path d="M7.5 1v14" />
            {!collapsed && <rect x="1.9" y="1.9" width="5.2" height="12.2" fill="currentColor" stroke="none" />}
          </svg>
          <span className={collapsed ? 'sr-only' : 'min-w-0 truncate'}>Games and friends playing</span>
        </button>
      </h2>
      <div id="games-list" className={`${open ? '' : 'hidden'} ${collapsed ? 'lg:hidden' : 'lg:block'}`}>
        {games.loading ? <Skeleton className="h-64" />
          : games.error ? <p className="text-sm text-muted">Could not load games. <button type="button" onClick={games.reload} className="underline">Retry</button></p>
          : <ul className="m-0 list-none p-0">{games.data.map((g) => <GameBlock key={g.game} {...g} />)}</ul>}
      </div>
    </aside>
  );
}
