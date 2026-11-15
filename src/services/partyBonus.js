import { col, withTxn } from '../db.js';
import { applyPoints } from './ledger.js';

export const PARTY_BONUS = 5; // points for joining (or starting) a party, once per UTC day
const today = () => new Date().toISOString().slice(0, 10);

// Pays the daily party bonus. The unique (user, day) row and the points commit together, so a second party the same
// day, or two requests racing, pays nothing. Never throws: the player has already joined, so a failure here only
// means no bonus. Returns the points paid (0 when already paid today).
export async function awardPartyBonus(user) {
  try {
    return await withTxn(async (session) => {
      await col('party_bonus_days').insertOne({ user_id: user._id, day: today(), created_at: new Date() }, { session });
      await applyPoints(session, { userId: user._id, delta: PARTY_BONUS, sourceType: 'party_bonus' });
      return PARTY_BONUS;
    });
  } catch (err) {
    if (err.code !== 11000) console.error('[parties] party bonus failed:', err.message);
    return 0;
  }
}
