import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Chip, Dialog, EmptyState, ErrorState, Skeleton, buttonStyles, errorMessage } from '../ui/primitives.jsx';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleDateString();

// One line saying what a code does, from the fields the API sends.
function terms(r) {
  if (r.kind === 'merch_percent') return `${r.percent}% off one merch order`;
  if (r.kind === 'merch_amount') return `${dollars(r.amount_cents)} off a merch order of ${dollars(r.min_spend_cents)} or more`;
  if (r.kind === 'raffle') return 'Your raffle entry number';
  return 'Keep this code to claim it';
}

function Code({ value }) {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast('Code copied.'); } catch { toast('Select the code to copy it.', 'error'); }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <code className="select-all rounded-sm bg-surface px-2 py-1 font-mono text-sm font-medium">{value}</code>
      <button type="button" onClick={copy} className="min-h-[40px] px-1 text-sm font-bold text-accent-text underline" aria-label={`Copy code ${value}`}>Copy</button>
    </span>
  );
}

export default function Rewards() {
  const { user, login, refresh } = useAuth();
  const toast = useToast();
  const perks = useAsync(() => api.listPerks(), []);
  const mine = useAsync(() => (user ? api.listMyPerks() : []), [user?._id]);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setTarget(null); setResult(null); };

  const confirm = async () => {
    setBusy(true);
    try {
      const { redemption } = await api.redeemPerk(target.id);
      // The header balance comes from the signed-in user, so refresh it (and the list of codes) before showing the result.
      await Promise.all([refresh(), mine.reload()]);
      setResult(redemption);
    } catch (e) { toast(errorMessage(e), 'error'); close(); } finally { setBusy(false); }
  };

  const groups = [...new Set((perks.data ?? []).map((p) => p.category ?? 'More rewards'))];

  return (
    <div className="max-w-feed">
      <h1 className="text-xl">Rewards</h1>
      <p className="mb-4 text-body-sm text-muted">Spend the points you earn on merch discounts, digital perks and raffle entries. They have no cash value.</p>

      {user && mine.data?.length > 0 && (
        <section aria-labelledby="mine-h" className="frame mb-8 p-4">
          <h2 id="mine-h" className="text-lg">Your rewards</h2>
          <ul className="m-0 mt-2 list-none p-0">
            {mine.data.map((r) => (
              <li key={r.id} className="grid gap-1.5 border-t border-border py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{r.title}</b>
                  <Chip on={r.status === 'active'}>{r.status === 'used' ? `Used ${r.used_at ? when(r.used_at) : ''}` : r.usable ? 'Ready to use' : 'Claimed'}</Chip>
                </div>
                <Code value={r.code} />
                <div className="text-sm text-muted">{terms(r)} · redeemed {when(r.created_at)}</div>
                {r.usable && <div><Link to="/merch" className="text-sm font-bold text-accent-text underline">Shop merch to use it</Link></div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {perks.loading ? <div className="grid gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        : perks.error ? <ErrorState error={perks.error} onRetry={perks.reload} />
        : !perks.data.length ? <EmptyState title="Nothing to redeem yet" body="New rewards will be listed here." />
        : groups.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="mb-6">
            <h2 id={`g-${g}`} className="text-lg">{g}</h2>
            <ul className="m-0 mt-1 list-none p-0">
              {perks.data.filter((p) => (p.category ?? 'More rewards') === g).map((p) => {
                const short = user && user.faze_points < p.cost;
                return (
                  <li key={p.id} className="flex items-center gap-3 border-t border-border py-4">
                    <div className="min-w-0 grow">
                      <div className="font-bold">{p.title}</div>
                      <div className="text-body-sm text-muted">{p.body}</div>
                    </div>
                    <span className="whitespace-nowrap font-bold text-accent-text">{p.cost.toLocaleString()} pts</span>
                    {user
                      ? <Button variant="primary" disabled={short} aria-label={`Redeem ${p.title}`} onClick={() => setTarget(p)}>{short ? 'Not enough' : 'Redeem'}</Button>
                      : <Button onClick={login}>Sign in</Button>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      <Dialog open={Boolean(target)} onClose={close} title={result ? 'Redeemed!' : 'Confirm redemption'}>
        {result ? (
          <>
            <p className="text-body-sm">You redeemed <b>{result.title}</b>. Here is your code:</p>
            <div className="mt-3"><Code value={result.code} /></div>
            <p className="mt-2 text-sm text-muted">{terms(result)}. It is also saved under Your rewards.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.usable && <Link to="/merch" className={buttonStyles('primary')} onClick={close}>Shop merch</Link>}
              <Button variant={result.usable ? 'secondary' : 'primary'} onClick={close}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-body-sm">Spend {target?.cost.toLocaleString()} points on <b>{target?.title}</b>? This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" loading={busy} onClick={confirm}>Spend points</Button>
              <Button onClick={close}>Cancel</Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
