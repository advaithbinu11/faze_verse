import { useState } from 'react';
import { Avatar, Button, Chip, EmptyState, ErrorState, Skeleton, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { DiscordLinkBanner } from '../ui/DiscordLink.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const SIZE = 5;

function Slots({ count, members = [] }) {
  return (
    <ul className="m-0 flex list-none gap-2 p-0" aria-label={`${count} of ${SIZE} spots filled`}>
      {Array.from({ length: SIZE }, (_, i) => {
        const m = members[i];
        return (
          <li key={i} className="grid min-w-0 justify-items-center gap-1 text-xs">
            <Avatar name={m?.name ?? 'P'} color={m?.profile_color ?? undefined} size={36} empty={i >= count} />
            <span className="max-w-[64px] truncate font-semibold text-muted">{i < count ? (m?.name ?? 'Taken') : 'Open spot'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Party() {
  const { user, status, login } = useAuth();
  const toast = useToast();
  const clusters = useAsync(() => (user ? api.listClusters() : []), [user?._id]);
  const parties = useAsync(() => (user ? api.listParties() : []), [user?._id]);
  const [busy, setBusy] = useState('');

  if (status === 'anonymous') {
    return <EmptyState title="Sign in to find players" body="Parties are matched from the games in your Steam library, so we need you to link it first." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} />;
  }

  // Sends the player to the party's Discord voice channel once they're in. Needs a linked Discord account.
  const openChannel = (party) => {
    if (party?.discord_channel_link && user?.discord_id) window.location.assign(party.discord_channel_link);
    else if (party?.discord_channel_link) toast('Link Discord on your profile to get into the voice channel.', 'error');
  };
  const act = async (key, fn, ok, redirect) => {
    setBusy(key);
    try {
      const result = await fn();
      toast(ok);
      await Promise.all([parties.reload(), clusters.reload()]);
      if (redirect) openChannel(result);
    }
    catch (e) { toast(errorMessage(e), 'error'); }
    finally { setBusy(''); }
  };
  const mine = (p) => p.people?.includes(user?._id);

  return (
    <div className="grid gap-10">
      <DiscordLinkBanner />
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <section aria-labelledby="cl-h">
        <h1 id="cl-h" className="text-xl">Players like you</h1>
        <p className="mb-4 text-body-sm text-muted">Grouped by games you both own, plus a shared region or followed team. Location is never used.</p>
        {clusters.loading ? <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          : clusters.error ? <ErrorState error={clusters.error} onRetry={clusters.reload} />
          : !clusters.data.length ? <EmptyState title="No matches yet" body="Add a region or a team you follow in your profile, and make sure your Steam library is public." />
          : (
            <ul className="m-0 list-none p-0">
              {clusters.data.map((c) => (
                <li key={c.game_id} className="flex items-center gap-3 border-t border-border py-4">
                  <div className="min-w-0 grow">
                    <div className="font-bold">{c.game_name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
                      <span>{c.players} players</span>
                      {c.shared_regions.map((r) => <Chip key={r}>{r}</Chip>)}
                      {c.shared_teams.map((t) => <Chip key={t}>{t}</Chip>)}
                    </div>
                  </div>
                  <Button variant="primary" loading={busy === `m${c.game_id}`} aria-label={`Find a ${c.game_name} party`}
                    onClick={() => act(`m${c.game_id}`, () => api.matchParty({ game_id: c.game_id, region: c.shared_regions[0] }), `Matched into a ${c.game_name} party.`, true)}>
                    Find party
                  </Button>
                </li>
              ))}
            </ul>
          )}
        <p className="mt-6 border-l-4 border-accent-text pl-2.5 text-[13px] text-muted">13+ only. No private DMs. Players under 18 only see other under-18s.</p>
      </section>

      <section aria-labelledby="pb-h">
        <h2 id="pb-h" className="text-xl">Party board</h2>
        <p className="mb-4 text-body-sm text-muted">Open parties, up to {SIZE} players each.</p>
        {parties.loading ? <Skeleton className="h-32" />
          : parties.error ? <ErrorState error={parties.error} onRetry={parties.reload} />
          : !parties.data.length ? <EmptyState title="Nobody is queued" body="Use Find party on a game to start one." />
          : (
            <ul className="m-0 grid list-none gap-4 p-0">
              {parties.data.map((p) => (
                <li key={p.party_id} className="rounded-lg border-2 border-text p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="text-lg">{p.game_name}</h3><div className="label">{p.region}</div></div>
                    {mine(p)
                      ? <div className="flex gap-2">
                          {p.discord_channel_link && <Button variant="primary" onClick={() => openChannel(p)}>Open voice</Button>}
                          <Button loading={busy === p.party_id} onClick={() => act(p.party_id, () => api.leaveParty(p.party_id), 'You left the party.')}>Leave</Button>
                        </div>
                      : <Button variant="primary" disabled={p.num_people >= SIZE} loading={busy === p.party_id} aria-label={`Join ${p.game_name} party`}
                          onClick={() => act(p.party_id, () => api.joinParty(p.party_id), 'You joined the party.', true)}>{p.num_people >= SIZE ? 'Full' : 'Join'}</Button>}
                  </div>
                  <div className="mt-3"><Slots count={p.num_people} members={p.members} /></div>
                </li>
              ))}
            </ul>
          )}
      </section>
      </div>
    </div>
  );
}
