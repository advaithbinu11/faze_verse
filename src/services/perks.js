import { randomBytes } from 'node:crypto';

// Rewards catalogue. Costs are in points. Discount perks produce a one-time code that merch checkout accepts.
//   merch_percent: percent off the order      merch_amount: fixed amount off, optionally with a minimum spend
//   digital / raffle: redeemed for a code that is shown on the page and has no checkout use
export const PERKS = [
  { id: 'merch-10', category: 'Merch discounts', title: '10% off merch', body: 'A one-time code for 10% off any merch order.', cost: 300, kind: 'merch_percent', percent: 10 },
  { id: 'merch-20', category: 'Merch discounts', title: '20% off any drop', body: 'A one-time code for 20% off any merch order.', cost: 700, kind: 'merch_percent', percent: 20 },
  { id: 'merch-15-off', category: 'Merch discounts', title: '$15 off a $60+ order', body: 'A one-time code for $15 off merch orders of $60 or more.', cost: 450, kind: 'merch_amount', amount_cents: 1500, min_spend_cents: 6000 },
  { id: 'merch-30-off', category: 'Merch discounts', title: '$30 off a $120+ order', body: 'A one-time code for $30 off merch orders of $120 or more.', cost: 900, kind: 'merch_amount', amount_cents: 3000, min_spend_cents: 12000 },
  { id: 'early-access', category: 'Digital', title: 'Early access to the next drop', body: 'Your code gets you in before the next merch drop opens to everyone.', cost: 500, kind: 'digital' },
  { id: 'wallpaper', category: 'Digital', title: 'Desktop wallpaper pack', body: 'Four exclusive wallpapers.', cost: 300, kind: 'digital' },
  { id: 'discord-role', category: 'Digital', title: 'Discord supporter role', body: 'A supporter role and colour in the community Discord.', cost: 600, kind: 'digital' },
  { id: 'badge', category: 'Digital', title: 'Profile badge', body: 'Show a Vault badge next to your name.', cost: 800, kind: 'digital' },
  { id: 'poster-raffle', category: 'Raffles', title: 'Signed poster raffle entry', body: 'One entry per redemption.', cost: 2500, kind: 'raffle' },
  { id: 'shoutout-raffle', category: 'Raffles', title: 'Creator shoutout raffle entry', body: 'One entry per redemption into the creator shoutout draw.', cost: 3500, kind: 'raffle' },
  { id: 'jersey-raffle', category: 'Raffles', title: 'Signed jersey raffle entry', body: 'One entry per redemption.', cost: 5000, kind: 'raffle' },
];

export const DISCOUNT_KINDS = ['merch_percent', 'merch_amount'];
export const findPerk = (id) => PERKS.find((p) => p.id === id);

// 32 symbols with no look-alikes (no 0/O/1/I); 256 % 32 === 0, so every symbol is equally likely.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chunk = () => Array.from(randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');
export const newCode = () => `FZ-${chunk()}-${chunk()}`;
export const CODE_PATTERN = /^FZ-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export const publicPerk = ({ id, category, title, body, cost, kind, percent, amount_cents, min_spend_cents }) =>
  ({ id, category, title, body, cost, kind, ...(percent && { percent }), ...(amount_cents && { amount_cents }), ...(min_spend_cents && { min_spend_cents }) });

export const publicRedemption = (r) => ({
  id: r._id,
  perk_id: r.perk_id,
  title: r.title,
  kind: r.kind,
  cost: r.cost,
  code: r.code,
  status: r.status,
  usable: DISCOUNT_KINDS.includes(r.kind) && r.status === 'active',
  created_at: r.created_at,
  ...(r.percent && { percent: r.percent }),
  ...(r.amount_cents && { amount_cents: r.amount_cents }),
  ...(r.min_spend_cents && { min_spend_cents: r.min_spend_cents }),
  ...(r.used_at && { used_at: r.used_at }),
});
