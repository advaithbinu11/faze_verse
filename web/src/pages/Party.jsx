import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avatar, Button, Chip, EmptyState, ErrorState, Skeleton, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { DiscordLinkBanner, useDiscordLink } from '../ui/DiscordLink.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const SIZE = 5;

// A team chip that only repeats the game's name adds nothing.
const teamsFor = (c) => c.shared_teams.filter((t) => t.toLowerCase() !== c.game_name.toLowerCase());
// The open party worth joining first: the fullest one, so squads fill up instead of spreading thin.
const fullest = (parties) => [...parties].sort((a, b) => b.num_people - a.num_people)[0];

// Each taken spot with a known player links to that player's page (your own goes to your Welcome page), like names on the feed.
function Slots({ count, members = [], me }) {
  return (
    <ul className="m-0 flex list-none gap-2 p-0" aria-label={`${count} of ${SIZE} spots filled`}>
      {Array.from({ length: SIZE }, (_, i) => {
        const m = members[i];
        const filled = i < count;
        const name = filled ? (m?.name ?? 'Taken') : 'Open spot';
        // Keyed on filled-ness so a newly taken spot remounts and plays the slot-in motion once.
        const face = (
          <>
            <Avatar name={m?.name ?? 'P'} color={m?.profile_color ?? undefined} size={40} empty={!filled} />
            <span title={name} className="max-w-[64px] truncate font-semibold text-muted">{name}</span>
          </>
        );
        return (
          <li key={`${i}-${filled}`} className={`min-w-0 text-xs ${filled ? 'slot-in' : ''}`}>
            {filled && m?.id
              ? <Link to={m.id === me ? '/welcome' : `/u/${m.id}`} aria-label={`${m.name}${m.id === me ? ' (you)' : ''}, view profile`} className="grid min-h-[44px] min-w-0 justify-items-center gap-1 no-underline hover:underline">{face}</Link>
              : <div className="grid min-w-0 justify-items-center gap-1">{face}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// One row per game: join the fullest open party when there is one, or start a fresh party. Both are secondary:
// the live parties on the board are the main action on this page.
function GameRow({ game, busy, onJoin, onStart }) {
  const open = game.open_parties ?? [];
  const teams = teamsFor(game);
  return (
    <li className="border-t border-border py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="m-0 font-display text-lg uppercase leading-tight tracking-wide">{game.game_name}</h3>
        {game.owned && <span className="text-sm font-semibold text-muted">You own this</span>}
      </div>
      {(game.shared_regions.length > 0 || teams.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {game.shared_regions.map((r) => <Chip key={r}>{r}</Chip>)}
          {teams.map((t) => <Chip key={t}>{t}</Chip>)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {open.length > 0 && (
          <Button loading={busy === `j${game.game_id}`} onClick={() => onJoin(game, fullest(open))} aria-label={`Join an open ${game.game_name} party (${open.length} open)`}>
            Join one of {open.length} open
          </Button>
        )}
        <Button loading={busy === `n${game.game_id}`} onClick={() => onStart(game)} aria-label={`Start a new ${game.game_name} party`}>Start a new party</Button>
        {open.length === 0 && <span className="text-sm text-muted">Nobody is queued yet.</span>}
      </div>
    </li>
  );
}

function PartyCard({ party, mine, busy, onJoin, onLeave, onVoice, discordLinked, me }) {
  const full = party.num_people >= SIZE;
  const hasVoice = Boolean(party.discord_channel_link);
  return (
    <li className={`rounded-lg border-2 p-4 ${mine && full ? 'border-accent' : 'border-text'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 break-words font-display text-2xl uppercase leading-none tracking-wide">{party.game_name}</h3>
          <div className="mt-1 text-sm text-muted">
            {party.region} · {full ? <b className="text-text">Squad full</b> : `${SIZE - party.num_people} spot${SIZE - party.num_people === 1 ? '' : 's'} open`}
          </div>
        </div>
        {mine ? (
          <div className="flex flex-wrap gap-2">
            {hasVoice && <Button variant="primary" onClick={() => onVoice(party)}>{discordLinked ? 'Open voice' : 'Link Discord for voice'}</Button>}
            <Button loading={busy === party.party_id} onClick={() => onLeave(party)}>Leave</Button>
          </div>
        ) : (
          <Button variant="primary" disabled={full} loading={busy === party.party_id} onClick={() => onJoin(party)} aria-label={`Join ${party.game_name} party`}>
            {full ? 'Full' : 'Join'}
          </Button>
        )}
      </div>
      <div className="mt-3"><Slots count={party.num_people} members={party.members} me={me} /></div>
    </li>
  );
}

export default function Party() {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const { link: linkDiscord } = useDiscordLink();
  const [params, setParams] = useSearchParams();
  const gameFilter = params.get('game');
  const clusters = useAsync(() => (user ? api.listClusters() : []), [user?._id]);
  const parties = useAsync(() => (user ? api.listParties() : []), [user?._id]);
  const [busy, setBusy] = useState('');

  if (status === 'anonymous') {
    return <EmptyState title="Sign in to find players" body="Sign in to join parties and open voice chats with other fans." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} />;
  }

  const mine = (p) => p.people?.includes(user?._id);
  // Joining never leaves the app: the party card offers "Open voice" once you are in.
  // The first party you join or start each day also pays a points bonus; refreshing the balance lets the wallet animation play.
  const act = async (key, fn, ok) => {
    setBusy(key);
    try {
      const result = await fn();
      toast(result?.bonus ? `${ok} +${result.bonus} points.` : ok);
      await Promise.all([parties.reload(), clusters.reload(), result?.bonus ? refresh() : null]);
    }
    catch (e) { toast(errorMessage(e), 'error'); }
    finally { setBusy(''); }
  };
  const joinParty = (p) => act(p.party_id, () => api.joinParty(p.party_id), `You joined the ${p.game_name} party.`);
  const joinFromGame = (g, open) => act(`j${g.game_id}`, () => api.joinParty(open.party_id), `You joined a ${g.game_name} party.`);
  const startParty = (g) => act(`n${g.game_id}`, () => api.createParty({ game_id: g.game_id, region: g.shared_regions[0] }), `Started a ${g.game_name} party.`);
  const leaveParty = (p) => act(p.party_id, () => api.leaveParty(p.party_id), 'You left the party.');
  const openVoice = (p) => { if (user?.discord_id) window.location.assign(p.discord_channel_link); else linkDiscord(); };

  const shown = (parties.data ?? []).filter((p) => !gameFilter || p.game_name.toLowerCase() === gameFilter.toLowerCase());
  const gameCard = clusters.data?.find((c) => c.game_name.toLowerCase() === gameFilter?.toLowerCase());

  return (
    <div className="grid gap-8">
      <DiscordLinkBanner />
      <div>
        <h1 className="text-xl">Party up</h1>
        <p className="mb-0 mt-1 max-w-[62ch] text-body-sm text-muted">Join a live squad or start your own voice party, for any game. Games you own come first. 13+ only, no private DMs, and players under 18 only see other under-18s.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <section aria-labelledby="pb-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="pb-h" className="text-xl">Open parties</h2>
            {gameFilter && <Link to="/party" className="inline-flex min-h-[44px] items-center text-sm font-bold underline">Showing {gameFilter}. Show all</Link>}
          </div>
          {parties.loading ? <Skeleton className="h-32" />
            : parties.error ? <ErrorState error={parties.error} onRetry={parties.reload} />
            : !shown.length ? (
              <EmptyState
                title={gameFilter ? `No open ${gameFilter} parties` : 'Nobody is queued'}
                body={gameFilter ? 'Be the first. Start one and friends can join from their games list.' : 'Start a party from the games list and it shows up here.'}
                action={gameCard ? <Button variant="primary" loading={busy === `n${gameCard.game_id}`} onClick={() => startParty(gameCard)}>Start a {gameCard.game_name} party</Button> : undefined}
              />
            ) : (
              <ul className="m-0 grid list-none gap-4 p-0">
                {shown.map((p) => (
                  <PartyCard key={p.party_id} party={p} mine={mine(p)} busy={busy} discordLinked={Boolean(user?.discord_id)} me={user?._id}
                    onJoin={joinParty} onLeave={leaveParty} onVoice={openVoice} />
                ))}
              </ul>
            )}
        </section>

        <section aria-labelledby="cl-h">
          <h2 id="cl-h" className="text-xl">Games</h2>
          <p className="mb-2 mt-1 text-body-sm text-muted">Pick a game to join a squad or start one. Chips show the regions and teams you share with other players.</p>
          {clusters.loading ? <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : clusters.error ? <ErrorState error={clusters.error} onRetry={clusters.reload} />
            : (
              <ul className="m-0 list-none p-0">
                {clusters.data.map((c) => <GameRow key={c.game_id} game={c} busy={busy} onJoin={joinFromGame} onStart={startParty} />)}
              </ul>
            )}
        </section>
      </div>
    </div>
  );
}
