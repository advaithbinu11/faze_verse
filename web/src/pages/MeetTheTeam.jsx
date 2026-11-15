import { useMemo, useState } from 'react';
import roster from '../data/roster.json';
import { PALETTE } from '../data/colors.js';
import { Avatar, Button, EmptyState, Pill, inputClass } from '../ui/primitives.jsx';

const PAGE = 48;

// The most common roles become filter chips.
const TOP_ROLES = (() => {
  const counts = new Map();
  for (const m of roster.members) for (const r of m.roles) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r]) => r);
})();

// Stable color per name for members without a photo.
const colorFor = (name) => PALETTE[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length][1];

function FeaturedCard({ person, decorative }) {
  return (
    <li className="mr-4 w-[220px] flex-none overflow-hidden rounded-lg border-2 border-text bg-bg">
      <div className="aspect-square bg-black">
        <img src={person.photo} alt={decorative ? '' : `Portrait of FaZe ${person.name}`} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover object-top" />
      </div>
      <div className="p-3">
        <h3 className="break-words text-lg">FaZe {person.name}</h3>
        <p className="mt-0.5 text-sm text-muted">{person.roles.slice(0, 2).join(' · ')}</p>
      </div>
    </li>
  );
}

// Constantly moving strip of the featured members. Pauses on hover/focus and via the button (WCAG 2.2.2),
// and does not move at all under prefers-reduced-motion. The second list is a visual duplicate only.
function Carousel() {
  const [paused, setPaused] = useState(false);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Play carousel' : 'Pause carousel'}</Button>
      </div>
      <div className="marquee -mx-[var(--page-gutter)]" data-paused={paused} role="region" aria-label="Featured members" tabIndex={0}>
        <div className="marquee-track" style={{ '--marquee-duration': `${roster.featured.length * 7}s` }}>
          <ul className="m-0 flex list-none p-0">{roster.featured.map((p) => <FeaturedCard key={p.name} person={p} />)}</ul>
          <ul className="m-0 flex list-none p-0" aria-hidden="true">{roster.featured.map((p) => <FeaturedCard key={p.name} person={p} decorative />)}</ul>
        </div>
      </div>
    </div>
  );
}

function Roster() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState(null);
  const [shown, setShown] = useState(PAGE);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.members.filter((m) => (!role || m.roles.includes(role)) && (!q || m.name.toLowerCase().includes(q)));
  }, [query, role]);

  const reset = (fn) => (v) => { fn(v); setShown(PAGE); };
  const visible = matches.slice(0, shown);

  return (
    <div className="mt-10">
      <h3 className="text-xl">Full roster</h3>
      <p className="mb-4 text-body-sm text-muted">Everyone who has worn the name, from founders to current players.</p>

      <div className="mb-4 grid gap-3">
        <div className="max-w-sm">
          <label htmlFor="roster-q" className="mb-1 block text-[13px] font-semibold">Search members</label>
          <input id="roster-q" type="search" className={inputClass} value={query} onChange={(e) => reset(setQuery)(e.target.value)} autoComplete="off" />
        </div>
        <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
          <Pill pressed={role === null} onClick={() => reset(setRole)(null)}>All</Pill>
          {TOP_ROLES.map((r) => <Pill key={r} pressed={role === r} onClick={() => reset(setRole)(role === r ? null : r)}>{r}</Pill>)}
        </div>
      </div>

      <p className="mb-2 text-sm text-muted" aria-live="polite">Showing {visible.length.toLocaleString()} of {matches.length.toLocaleString()} members</p>

      {matches.length === 0 ? (
        <EmptyState title="No one matches" body="Try a different name or clear the role filter." action={<Button onClick={() => { setQuery(''); setRole(null); }}>Clear filters</Button>} />
      ) : (
        <ul className="m-0 grid list-none gap-x-6 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((m, i) => ( // names repeat in the source list, so the index is part of the key
            <li key={`${m.name}-${i}`} className="flex items-center gap-3 border-t border-border py-2.5">
              <Avatar name={m.name} size={40} color={colorFor(m.name)} />
              <div className="min-w-0">
                <div className="truncate font-bold">FaZe {m.name}</div>
                <div className="truncate text-sm text-muted">{m.roles.join(', ')}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {shown < matches.length && (
        <div className="mt-4"><Button onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, matches.length - shown)} more</Button></div>
      )}
    </div>
  );
}

export default function MeetTheTeam() {
  const credited = roster.featured.filter((p) => p.credit);
  return (
    <section aria-labelledby="team-h" className="mb-12">
      <h2 id="team-h" className="text-xl">Meet the team</h2>
      <p className="mb-5 max-w-[60ch] text-body-sm text-muted">
        {roster.total.toLocaleString()} members across creators, Call of Duty, Fortnite and CS2. Here are some faces you will know.
      </p>

      <Carousel />

      <Roster />

      {credited.length > 0 && (
        <div className="mt-8 border-t border-border pt-3 text-xs font-normal text-muted">
          <h3 className="label mb-1">Photo credits</h3>
          <ul className="m-0 list-none p-0">
            {credited.map((p) => (
              <li key={p.name}>
                FaZe {p.name}: <a className="underline" href={p.credit.source} target="_blank" rel="noreferrer">“{p.credit.title}”</a> by {p.credit.photographer},{' '}
                <a className="underline" href={p.credit.terms} target="_blank" rel="noreferrer">{p.credit.license}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
