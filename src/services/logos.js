import { randomInt } from 'node:crypto';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { applyPoints } from './ledger.js';

// Profile logos: the mark-only PNGs from the brand `_LOGOS` folder (served from web/public/logos), each drawn on a
// backdrop colour. A purchase rolls a random (logo, backdrop) pair the player does not own yet.
export const LOGO_COST = 2000;

export const LOGOS = [
  { id: 'white', image: '/logos/white.png', ink: '#ffffff' },
  { id: 'black', image: '/logos/black.png', ink: '#000000' },
  { id: 'red-outline', image: '/logos/red-outline.png', ink: '#e4002b' },
  { id: 'white-outline', image: '/logos/white-outline.png', ink: '#ffffff' },
];
export const BACKDROPS = ['#0b0b0b', '#18181b', '#1f2937', '#2563eb', '#7c3aed', '#0f766e', '#be185d', '#b45309', '#e4002b', '#0ea5e9', '#22c55e', '#fbbf24', '#e5e5e5', '#f5f5f5', '#ffffff'];
export const MIN_CONTRAST = 3;

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// Every pairing on offer keeps the mark readable against its backdrop.
export const PAIRINGS = LOGOS.flatMap((logo) => BACKDROPS.filter((bg) => contrast(logo.ink, bg) >= MIN_CONTRAST).map((backdrop) => ({ logo_id: logo.id, backdrop })));
const logoById = new Map(LOGOS.map((l) => [l.id, l]));

export const publicLogo = (row) => row && { id: row._id, logo_id: row.logo_id, image: logoById.get(row.logo_id)?.image ?? null, backdrop: row.backdrop, created_at: row.created_at };

export async function listLogos(user) {
  const rows = await col('profile_logos').find({ user_id: user._id }).sort({ created_at: -1 }).toArray();
  return { cost: LOGO_COST, owned: rows.map(publicLogo), active_id: user.active_logo_id ?? null, total: PAIRINGS.length };
}

// The logo a player has switched on, in the shape the web app draws; null means initials.
export async function activeLogoOf(user) {
  if (!user.active_logo_id) return null;
  const row = await col('profile_logos').findOne({ _id: user.active_logo_id, user_id: user._id });
  return publicLogo(row) ?? null;
}

// Spends LOGO_COST and grants one random logo, in one transaction. The unique (user, logo, backdrop) index is the
// final guard against a duplicate when two purchases race; the loser re-rolls.
export async function buyLogo(user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const owned = new Set((await col('profile_logos').find({ user_id: user._id }).project({ logo_id: 1, backdrop: 1 }).toArray()).map((r) => `${r.logo_id}|${r.backdrop}`));
    const choices = PAIRINGS.filter((p) => !owned.has(`${p.logo_id}|${p.backdrop}`));
    if (!choices.length) throw new HttpError(409, 'You already own every profile logo');
    const pick = choices[randomInt(choices.length)];
    try {
      return await withTxn(async (session) => {
        const balance = await applyPoints(session, { userId: user._id, delta: -LOGO_COST, sourceType: 'logo_purchase' });
        const doc = { user_id: user._id, logo_id: pick.logo_id, backdrop: pick.backdrop, cost: LOGO_COST, created_at: new Date() };
        const { insertedId } = await col('profile_logos').insertOne(doc, { session });
        return { logo: publicLogo({ ...doc, _id: insertedId }), balance };
      });
    } catch (e) {
      if (e.code !== 11000 && !e.errorLabelSet?.has?.('TransientTransactionError')) throw e;
    }
  }
  throw new HttpError(409, 'Could not complete that purchase. Try again.');
}

export async function setActiveLogo(user, logoId) {
  if (logoId !== null) {
    const row = await col('profile_logos').findOne({ _id: logoId, user_id: user._id }, { projection: { _id: 1 } });
    if (!row) throw new HttpError(404, 'You do not own that logo');
  }
  await col('users').updateOne({ _id: user._id }, logoId ? { $set: { active_logo_id: logoId } } : { $unset: { active_logo_id: '' } });
}
