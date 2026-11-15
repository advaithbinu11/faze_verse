import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { applyPoints } from '../services/ledger.js';
import { CODE_PATTERN, DISCOUNT_KINDS } from '../services/perks.js';
import { MAX_QTY, SIGNATURE_POINTS, SIZES, findItem, isSized, priceOrder } from '../services/merch.js';

const router = Router();

// Checkout takes no payment yet, but it does award points, so one account can only place so many orders an hour.
const orderLimiter = rateLimit({
  windowMs: 3_600_000,
  limit: 20,
  keyGenerator: (req) => String(req.user._id),
  skipFailedRequests: true, // only orders that went through count; a typo or an unusable code should not use up the allowance
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many orders. Try again later.' },
});

const orderSchema = z.object({
  item_id: z.string().trim().min(1).max(100),
  qty: z.number().int().min(1).max(MAX_QTY),
  size: z.enum(SIZES).optional(),
  signed: z.boolean().default(false),
  code: z.string().trim().toUpperCase().regex(CODE_PATTERN, 'Enter a valid code, like FZ-ABCD-2345').optional(),
}).strict();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const orderNumber = () => `FZ-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')}`;
const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;

// Places a demo order. Prices come from the server's catalogue, never from the request. In one transaction it:
//   1. spends the reward code (if any), 2. debits the signature (if any), 3. credits points for what was paid, 4. records the order.
// If any step fails (unusable code, not enough points) none of them happen.
router.post('/orders', requireAuth, orderLimiter, async (req, res) => {
  const body = orderSchema.parse(req.body);
  const item = findItem(body.item_id);
  if (!item) throw new HttpError(404, 'That item does not exist');
  if (item.sold_out) throw new HttpError(409, 'That item is sold out');
  if (isSized(item.category) && !body.size) throw new HttpError(400, 'Choose a size');

  const out = await withTxn(async (session) => {
    let coupon = null;
    if (body.code) {
      coupon = await col('redemptions').findOne({ code: body.code, user_id: req.user._id, kind: { $in: DISCOUNT_KINDS } }, { session });
      if (!coupon) throw new HttpError(404, 'That code was not found on your account');
      if (coupon.status !== 'active') throw new HttpError(409, 'That code has already been used');
      if (item.price_cents * body.qty < (coupon.min_spend_cents ?? 0)) {
        throw new HttpError(400, `This code needs an order of ${dollars(coupon.min_spend_cents)} or more`);
      }
    }

    const price = priceOrder({ unit_cents: item.price_cents, qty: body.qty, coupon });
    if (coupon) {
      const used = await col('redemptions').findOneAndUpdate({ _id: coupon._id, status: 'active' }, { $set: { status: 'used', used_at: new Date() } }, { session });
      if (!used) throw new HttpError(409, 'That code has already been used');
    }

    // The signature is paid from the balance you had before this order; points earned by it do not count towards it.
    const signature_points = body.signed ? SIGNATURE_POINTS * body.qty : 0;
    let balance;
    if (signature_points) balance = await applyPoints(session, { userId: req.user._id, delta: -signature_points, sourceType: 'signature' });
    if (price.points_earned) balance = await applyPoints(session, { userId: req.user._id, delta: price.points_earned, sourceType: 'merch_purchase' });
    if (balance === undefined) balance = (await col('users').findOne({ _id: req.user._id }, { session, projection: { faze_points: 1 } })).faze_points;

    const doc = {
      user_id: req.user._id,
      number: orderNumber(),
      item_id: item.id,
      name: item.name,
      ...(isSized(item.category) && { size: body.size }),
      qty: body.qty,
      unit_cents: item.price_cents,
      ...price,
      ...(coupon && price.discount_cents > 0 && { coupon_code: coupon.code }),
      signature_points,
      created_at: new Date(),
    };
    await col('orders').insertOne(doc, { session });
    return { doc, balance };
  });

  const { doc } = out;
  res.status(201).json({
    order: {
      number: doc.number, item_id: doc.item_id, name: doc.name, size: doc.size ?? null, qty: doc.qty, unit_cents: doc.unit_cents,
      subtotal_cents: doc.subtotal_cents, discount_cents: doc.discount_cents, total_cents: doc.total_cents, coupon_code: doc.coupon_code ?? null,
      points_earned: doc.points_earned, signature_points: doc.signature_points, signed: doc.signature_points > 0, created_at: doc.created_at,
    },
    balance: out.balance,
  });
});

export default router;
