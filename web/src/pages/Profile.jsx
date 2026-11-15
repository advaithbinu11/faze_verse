import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ColorPicker } from '../ui/ColorPicker.jsx';
import { useDiscordLink } from '../ui/DiscordLink.jsx';
import { Avatar, Button, EmptyState, ErrorState, Pill, Skeleton, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const TEAMS = ['FaZe', 'Valorant', 'Rocket League', 'Apex', 'Fortnite'];
const REGIONS = ['NA', 'EU', 'APAC', 'LATAM', 'MENA'];
const LABELS = { prediction: 'Prediction', payout: 'Payout', refund: 'Refund', watch_time: 'Watch bonus', redemption: 'Redemption', signup_bonus: 'Welcome bonus', merch_purchase: 'Merch purchase', signature: 'Signed merch' };
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function Profile() {
  const { user, status, login, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const tx = useAsync(() => (user ? api.listTransactions() : []), [user?._id, user?.faze_points]);
  const [teams, setTeams] = useState([]);
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState('#e4002b');
  const { link: linkDiscord, linking } = useDiscordLink();
  const [params, setParams] = useSearchParams();
  useEffect(() => { if (user) { setTeams(user.teams_followed ?? []); setRegions(user.regions ?? []); setColor(user.profile_color ?? '#e4002b'); } }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateProfile({ teams_followed: teams, regions, profile_color: color });
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
            <Avatar name={user.name} size={64} color={user.profile_color} />
            <div className="min-w-0">
              <div className="label">Signed in as</div>
              <h1 id="pf-h" className="break-words text-xl">{user.name}</h1>
              <p className="text-body-sm text-muted">{user.faze_points.toLocaleString()} points · {user.steam_game_count ?? user.steam_games?.length ?? 0} Steam games linked</p>
            </div>
          </div>
        </div>
        <form onSubmit={save} className="grid gap-5" noValidate>
          <ColorPicker value={color} onChange={setColor} name={user.name} />
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold">Teams you follow</legend>
            <div className="flex flex-wrap gap-2">{TEAMS.map((t) => <Pill key={t} pressed={teams.includes(t)} onClick={() => setTeams(toggle(teams, t))}>{t}</Pill>)}</div>
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
    </div>
  );
}
