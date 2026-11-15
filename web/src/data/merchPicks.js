import { MERCH } from './merch.js';

const COUNT = 5; // pieces in the strip, not counting the "See all" tile

// What a followed team or player says about the shop. Only links the catalogue really supports: CS2 has Counter Strike
// jerseys and the Cybear line. Anything else matches on the item's own name.
const ALIASES = { cs2: ['counter strike', 'cybear'], 'counter-strike': ['counter strike', 'cybear'], 'counter-strike 2': ['counter strike', 'cybear'] };
const words = (s) => s.toLowerCase().replace(/^faze\s+/, '').trim();

// Small stable hash so the picks stay put for a player all day instead of reshuffling on every visit.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Items matching what the player follows come first (with the reason), then deals, then a spread across categories.
export function pickForYou(user, count = COUNT, day = new Date().toDateString()) {
  const interests = [...(user?.teams_followed ?? []), ...(user?.favorite_players ?? [])].map((i) => ({ label: i, terms: ALIASES[words(i)] ?? [words(i)] })).filter((i) => i.terms[0].length >= 3);
  const seed = `${user?._id ?? 'guest'}|${day}`;
  const tie = (id) => hash(`${seed}|${id}`);
  const stocked = MERCH.filter((m) => !m.soldOut);
  const scored = stocked.map((m) => {
    const hit = interests.find((i) => i.terms.some((t) => m.name.toLowerCase().includes(t)));
    return { item: m, reason: hit ? `For your ${hit.label}` : m.was ? 'On sale' : null, rank: hit ? 0 : m.was ? 1 : 2 };
  }).sort((a, b) => a.rank - b.rank || tie(a.item.id) - tie(b.item.id));

  // Spread categories: take the best of each in turn so the strip is not ten tees.
  const picked = [];
  const used = new Set();
  const byCat = new Map();
  for (const s of scored) byCat.set(s.item.category, [...(byCat.get(s.item.category) ?? []), s]);
  const cats = [...byCat.keys()];
  for (let round = 0; picked.length < count && round < 10; round++) {
    for (const c of cats) {
      const next = byCat.get(c)[round];
      if (next && !used.has(next.item.id) && picked.length < count) { used.add(next.item.id); picked.push(next); }
    }
  }
  return picked.sort((a, b) => a.rank - b.rank);
}
