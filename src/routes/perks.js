import { Router } from 'express';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { applyPoints } from '../services/ledger.js';
import { CODE_PATTERN, DISCOUNT_KINDS, PERKS, findPerk, newCode, publicPerk, publicRedemption } from '../services/perks.js';

const router = Router();

// The catalogue is public so signed-out visitors can browse it.
router.get('/', (_req, res) => res.json(PERKS.map(publicPerk)));

// Everything you have redeemed, newest first, including codes already used.
router.get('/mine', requireAuth, async (req, res) => {
  const rows = await col('redemptions').find({ user_id: req.user._id }).sort({ created_at: -1 }).limit(100).toArray();
  res.json(rows.map(publicRedemption));
});

// Spends points and issues a code in one transaction: the debit, the ledger row and the code commit or abort together.
router.post('/:perkId/redeem', requireAuth, async (req, res) => {
  const perk = findPerk(req.params.perkId);
  if (!perk) throw new HttpError(404, 'Reward not found');

  const result = await withTxn(async (session) => {
    const balance = await applyPoints(session, { userId: req.user._id, delta: -perk.cost, sourceType: 'redemption' });
    const doc = {
      user_id: req.user._id,
      perk_id: perk.id,
      title: perk.title,
      kind: perk.kind,
      cost: perk.cost,
      code: newCode(),
      status: 'active',
      created_at: new Date(),
      ...(perk.percent && { percent: perk.percent }),
      ...(perk.amount_cents && { amount_cents: perk.amount_cents }),
      ...(perk.min_spend_cents && { min_spend_cents: perk.min_spend_cents }),
    };
    const { insertedId } = await col('redemptions').insertOne(doc, { session });
    return { redemption: { ...doc, _id: insertedId }, balance };
  });
  res.status(201).json({ redemption: publicRedemption(result.redemption), balance: result.balance });
});

const parseCode = (raw) => {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new HttpError(400, 'Enter a valid code, like FZ-ABCD-2345');
  return code;
};
const mine = (req, code) => ({ code, user_id: req.user._id, kind: { $in: DISCOUNT_KINDS } });

// Checks that a merch code belongs to you and is unused, so checkout can show the discount before you confirm.
router.get('/coupons/:code', requireAuth, async (req, res) => {
  const row = await col('redemptions').findOne(mine(req, parseCode(req.params.code)));
  if (!row) throw new HttpError(404, 'That code was not found on your account');
  if (row.status !== 'active') throw new HttpError(409, 'That code has already been used');
  res.json(publicRedemption(row));
});

// Marks a code used. The status check and the write are one atomic update, so a code can only be spent once.
router.post('/coupons/:code/use', requireAuth, async (req, res) => {
  const code = parseCode(req.params.code);
  const used = await col('redemptions').findOneAndUpdate(
    { ...mine(req, code), status: 'active' },
    { $set: { status: 'used', used_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (used) return res.json(publicRedemption(used));
  const exists = await col('redemptions').findOne(mine(req, code), { projection: { _id: 1 } });
  throw exists ? new HttpError(409, 'That code has already been used') : new HttpError(404, 'That code was not found on your account');
});

export default router;
