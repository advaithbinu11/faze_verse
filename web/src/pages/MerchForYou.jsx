import { useMemo } from 'react';
import { Link } from 'react-router';
import { MERCH, pointsEarned } from '../data/merch.js';
import { pickForYou } from '../data/merchPicks.js';
import { useAuth } from '../state/AuthContext.jsx';

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

function Card({ item, reason }) {
  const pts = pointsEarned(Math.round(item.price * 100));
  return (
    <li className="w-[157px] flex-none snap-start">
      <Link to={`/merch?item=${item.id}`} className="frame grid h-full content-start gap-2 p-3 no-underline" aria-label={`${item.name}, ${money(item.price)}, earn up to ${pts.toLocaleString()} FaZe Points`}>
        <span className="relative block aspect-square overflow-hidden bg-surface">
          <img src={item.image} alt="" loading="lazy" decoding="async" width={157} height={157} className="absolute inset-0 h-full w-full object-cover" />
        </span>
        {reason && <span className="label">{reason}</span>}
        <span className="text-base font-bold">{item.name}</span>
        <span className="font-display text-lg uppercase">
          {money(item.price)}{item.was && <s className="ml-2 text-sm text-muted">{money(item.was)}</s>}
        </span>
        <span className="text-sm font-bold text-accent-text">Earn up to {pts.toLocaleString()} FaZe Points</span>
      </Link>
    </li>
  );
}

// "Merch Selected for You": a swipeable strip of pieces, each with the FaZe Points it could earn
// (1,000 for every full $10 paid). Scrolls by hand (swipe, trackpad or keyboard), so nothing moves on its own.
export default function MerchForYou() {
  const { user } = useAuth();
  const picks = useMemo(() => pickForYou(user), [user]);
  const personal = picks.some((p) => p.reason?.startsWith('For your'));
  return (
    <section aria-labelledby="mfy-h">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="mfy-h" className="text-xl">Merch Selected for You</h2>
          <p className="m-0 mt-1 max-w-[62ch] text-body-sm text-muted">
            {personal ? 'Picked from the teams and players you follow, plus current deals.' : 'Current deals and a mix from across the shop.'} Points are earned on what you pay: 1,000 for every full $10.
          </p>
        </div>
      </div>
      <div role="region" aria-label="Merch selected for you" tabIndex={0} className="-mx-[var(--page-gutter)] overflow-x-auto px-[var(--page-gutter)] lg:group-data-[sidebar=true]/shell:ml-0 lg:group-data-[sidebar=true]/shell:pl-0 pb-3">
        <ul className="m-0 flex snap-x snap-mandatory list-none gap-4 p-0">
          {picks.map((p) => <Card key={p.item.id} {...p} />)}
          <li className="w-[157px] flex-none snap-start">
            <Link to="/merch" className="frame grid h-full min-h-[157px] place-content-center p-3 text-center font-bold no-underline">See all {MERCH.length} pieces</Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
