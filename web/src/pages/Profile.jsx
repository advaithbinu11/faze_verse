import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ColorPicker } from '../ui/ColorPicker.jsx';
import { useDiscordLink } from '../ui/DiscordLink.jsx';
import { Avatar, Button, EmptyState, ErrorState, Pill, Skeleton, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { MAX_FAVORITES, PLAYER_GROUPS } from '../data/players.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const TEAMS = ['FaZe', 'Valorant', 'Rocket League', 'Apex', 'Fortnite'];
const REGIONS = ['NA', 'EU', 'APAC', 'LATAM', 'MENA'];
const LABELS = { prediction: 'Prediction', payout: 'Payout', refund: 'Refund', watch_time: 'Watch bonus', redemption: 'Redemption', signup_bonus: 'Welcome bonus', merch_purchase: 'Merch purchase', signature: 'Signed merch', shorts_bonus: 'Shorts bonus', post_bonus: 'Post bonus', logo_purchase: 'Profile logo', party_bonus: 'Party bonus' };
const known = new Set(PLAYER_GROUPS.flatMap((g) => g.players));
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function Profile() {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tx = useAsync(() => (user ? api.listTransactions() : []), [user?._id, user?.faze_points]);
  const recent = useAsync(() => (user ? api.getRecentShorts(12) : []), [user?._id, user?.faze_points]);
  const [teams, setTeams] = useState([]);
  const [regions, setRegions] = useState([]);
  const [players, setPlayers] = useState([]);
  const logos = useAsync(() => (user && api.listLogos ? api.listLogos() : null), [user?._id]);
  const [switching, setSwitching] = useState('');
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState('#e4002b');
  const { link: linkDiscord, linking } = useDiscordLink();
  const [params, setParams] = useSearchParams();
  useEffect(() => { if (user) { setTeams(user.teams_followed ?? []); setRegions(user.regions ?? []); setPlayers(user.favorite_players ?? []); setColor(user.profile_color ?? '#e4002b'); } }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Discord sends the player back here with ?discord=<result>.
  useEffect(() => {
    const result = params.get('discord');
    if (!result) return;
    const messages = { linked: 'Discord linked. You now have access to your party channels.', cancelled: 'Discord linking was cancelled.', expired: 'That link expired. Try again.', taken: 'That Discord account is linked to another player.', error: 'Could not link Discord. Try again.' };
    toast(messages[result] ?? messages.error, result === 'linked' ? undefined : 'error');
    setParams({}, { replace: true });
    if (result === 'linked') refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <Skeleton className="h-64" />;
  if (!user) return <EmptyState title="Sign in to see your profile" body="Your balance, history and matching preferences live here." action={<Button variant="primary" onClick={login}>Sign in with Steam</Button>} />;

  // Switching a logo on or off applies at once; it is not part of the Save button below.
  const chooseLogo = async (id) => {
    setSwitching(id ?? 'none');
    try { await api.setActiveLogo(id); await Promise.all([refresh(), logos.reload()]); toast(id ? 'Profile logo switched on.' : 'Showing your initials.'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setSwitching(''); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateProfile({ teams_followed: teams, favorite_players: players, regions, profile_color: color });
      await refresh();
      toast('Profile saved.');
      navigate('/welcome');
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <section aria-labelledby="pf-h">
        <div className="frame mb-6 p-5">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size={64} color={user.profile_color} logo={user.profile_logo} />
            <div className="min-w-0">
              <div className="label">Signed in as</div>
              <h1 id="pf-h" className="break-words text-xl">{user.name}</h1>
              <p className="text-body-sm text-muted">{user.faze_points.toLocaleString()} points · {user.steam_game_count ?? user.steam_games?.length ?? 0} Steam games linked</p>
            </div>
          </div>
        </div>
        {api.listLogos && (
          <fieldset className="m-0 mb-6 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold">Profile logo</legend>
            {/* No data yet also covers the render between the user arriving and the fetch starting, when loading is still false. */}
            {logos.error ? <ErrorState error={logos.error} onRetry={logos.reload} />
              : logos.loading || !logos.data ? <Skeleton className="h-16" />
              : !logos.data.owned.length ? (
                <p className="m-0 text-body-sm text-muted">You have no logos yet. <Link to="/rewards" className="font-bold text-accent-text underline">Buy a random one in Rewards</Link> for {logos.data.cost.toLocaleString()} points.</p>
              ) : (
                <>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    <li>
                      <button type="button" aria-pressed={!user.profile_logo} disabled={Boolean(switching)} onClick={() => chooseLogo(null)} aria-label="Use my initials"
                        className={`grid min-h-[44px] place-items-center rounded-full border-2 p-1 ${!user.profile_logo ? 'border-accent' : 'border-border'}`}>
                        <Avatar name={user.name} size={56} color={user.profile_color} />
                      </button>
                    </li>
                    {logos.data.owned.map((l) => (
                      <li key={l.id}>
                        <button type="button" aria-pressed={user.profile_logo?.id === l.id} disabled={Boolean(switching)} onClick={() => chooseLogo(l.id)} aria-label={`Use FaZe logo ${l.logo_id.replace('-', ' ')} on ${l.backdrop}`}
                          className={`grid min-h-[44px] place-items-center rounded-full border-2 p-1 ${user.profile_logo?.id === l.id ? 'border-accent' : 'border-border'}`}>
                          <Avatar name={user.name} size={56} logo={l} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-0 mt-2 text-sm text-muted">{user.profile_logo ? 'Your logo shows on your Welcome page and your player page.' : 'Pick a logo to show instead of your initials.'} <Link to="/rewards" className="font-bold text-accent-text underline">Get another</Link></p>
                </>
              )}
          </fieldset>
        )}
        <form onSubmit={save} className="grid gap-5" noValidate>
          <ColorPicker value={color} onChange={setColor} name={user.name} />
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold">Teams you follow</legend>
            <div className="flex flex-wrap gap-2">{TEAMS.map((t) => <Pill key={t} pressed={teams.includes(t)} onClick={() => setTeams(toggle(teams, t))}>{t}</Pill>)}</div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[13px] font-semibold">Streamers and players you like</legend>
            <p className="mb-3 mt-1 text-sm text-muted" aria-live="polite">Pick up to {MAX_FAVORITES}. {players.length} chosen. These shape your fun facts and shorts.</p>
            <div className="grid gap-3">
              {[...PLAYER_GROUPS, ...(players.some((p) => !known.has(p)) ? [{ label: 'Others you added', players: players.filter((p) => !known.has(p)) }] : [])].map((g) => (
                <div key={g.label}>
                  <div className="mb-1.5 text-sm text-muted">{g.label}</div>
                  <div className="flex flex-wrap gap-2">{g.players.map((p) => <Pill key={p} pressed={players.includes(p)} disabled={players.length >= MAX_FAVORITES && !players.includes(p)} onClick={() => setPlayers(toggle(players, p))}>{p}</Pill>)}</div>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold">Regions</legend>
            <div className="flex flex-wrap gap-2">{REGIONS.map((r) => <Pill key={r} pressed={regions.includes(r)} onClick={() => setRegions(toggle(regions, r))}>{r}</Pill>)}</div>
          </fieldset>
          <div>
            <div className="mb-2 text-[13px] font-semibold">Discord</div>
            {user.discord_id ? (
              <p className="m-0 text-body-sm">Linked{user.discord_username ? <> as <b>{user.discord_username}</b></> : null}. Party channels open for you automatically.</p>
            ) : (
              <>
                <p className="mb-2 mt-0 text-body-sm text-muted">Link Discord to join your parties' voice channels and get match reminders.</p>
                {api.startDiscordLink && <Button type="button" onClick={linkDiscord} loading={linking}>Link Discord</Button>}
              </>
            )}
          </div>
          <div><Button variant="primary" type="submit" loading={busy}>Save profile</Button></div>
        </form>
      </section>

      <section aria-labelledby="tx-h">
        <h2 id="tx-h" className="text-xl">Points history</h2>
        {tx.loading ? <Skeleton className="mt-3 h-40" />
          : tx.error ? <ErrorState error={tx.error} onRetry={tx.reload} />
          : !tx.data.length ? <EmptyState title="No activity yet" body="Predictions, watch bonuses and redemptions show up here." />
          : (
            <ul className="m-0 mt-3 list-none p-0">
              {tx.data.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-body-sm">
                  <span><b>{LABELS[t.source_type] ?? t.source_type}</b> <time className="text-muted" dateTime={t.timestamp}>{new Date(t.timestamp).toLocaleDateString()}</time></span>
                  <span className={t.points < 0 ? 'text-muted' : 'font-bold text-success'}>{t.points > 0 ? '+' : ''}{t.points.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section aria-labelledby="rw-h" className="md:col-span-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="rw-h" className="text-xl">Recently watched</h2>
          <Link to="/shorts" className="text-sm font-bold text-accent-text underline">Watch more shorts</Link>
        </div>
        {recent.loading ? <div className="mt-3 flex gap-3"><Skeleton className="h-48 w-28" /><Skeleton className="h-48 w-28" /><Skeleton className="h-48 w-28" /></div>
          : recent.error ? <ErrorState error={recent.error} onRetry={recent.reload} />
          : !recent.data.length ? <div className="mt-3"><EmptyState title="Nothing watched yet" body="Shorts you watch show up here, newest first." /></div>
          : (
            <ul className="m-0 mt-3 flex list-none gap-3 overflow-x-auto p-0 pb-2">
              {recent.data.map((s) => (
                <li key={s.id} className="w-28 flex-none">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="block" title={s.title}>
                    <span className="relative block aspect-[9/16] overflow-hidden bg-surface">
                      {s.thumb && <img src={s.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                    </span>
                    <span className="mt-1 block truncate text-[13px] font-bold">{s.title}</span>
                    <span className="block truncate text-xs text-muted">{s.game} · {new Date(s.viewed_at).toLocaleDateString()}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
