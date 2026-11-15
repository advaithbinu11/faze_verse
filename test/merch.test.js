import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as web from '../web/src/data/merch.js';
import { BLOCK_CENTS, MAX_QTY, MERCH_ITEMS, POINTS_PER_BLOCK, SIGNATURE_POINTS, SIZES, discountCents, findItem, isSized, pointsEarned, priceOrder } from '../src/services/merch.js';
import { validators } from '../src/schemas.js';

test('1,000 points per full $10 paid, rounding down', () => {
  assert.equal(pointsEarned(0), 0);
  assert.equal(pointsEarned(999), 0);
  assert.equal(pointsEarned(1000), 1000);
  assert.equal(pointsEarned(3999), 3000); // $39.99 is three full $10 blocks
  assert.equal(pointsEarned(4000), 4000);
  assert.equal(pointsEarned(6120), 6000); // $61.20
  assert.equal(pointsEarned(15000 * 10), 150000);
});

test('discount codes: percent of subtotal, fixed amount capped at subtotal, minimum spend enforced', () => {
  const pct = { kind: 'merch_percent', percent: 10 };
  assert.equal(discountCents(pct, 6800), 680);
  assert.equal(discountCents({ kind: 'merch_percent', percent: 20 }, 3333), 667); // rounds to whole cents
  const amt = { kind: 'merch_amount', amount_cents: 1500, min_spend_cents: 6000 };
  assert.equal(discountCents(amt, 5999), 0); // below the minimum: no discount
  assert.equal(discountCents(amt, 6000), 1500);
  assert.equal(discountCents({ kind: 'merch_amount', amount_cents: 3000 }, 1200), 1200); // never more than the order
  assert.equal(discountCents(null, 5000), 0);
  assert.equal(discountCents({ kind: 'raffle' }, 5000), 0); // only merch codes discount
});

test('points are earned on what was paid after the discount', () => {
  // $68 jersey with 10% off: $61.20 paid -> 6 blocks, not 6.8
  const r = priceOrder({ unit_cents: 6800, qty: 1, coupon: { kind: 'merch_percent', percent: 10 } });
  assert.deepEqual(r, { subtotal_cents: 6800, discount_cents: 680, total_cents: 6120, points_earned: 6000 });
  // two $40 tees, no code
  assert.equal(priceOrder({ unit_cents: 4000, qty: 2 }).points_earned, 8000);
  // a discount can drop an order under a block boundary
  assert.equal(priceOrder({ unit_cents: 1200, qty: 1, coupon: { kind: 'merch_percent', percent: 10 } }).points_earned, 1000);
  assert.equal(priceOrder({ unit_cents: 1000, qty: 1, coupon: { kind: 'merch_percent', percent: 10 } }).points_earned, 0); // $9.00
});

test('signature costs 15,000 points', () => {
  assert.equal(SIGNATURE_POINTS, 15000);
  assert.equal(POINTS_PER_BLOCK, 1000);
  assert.equal(BLOCK_CENTS, 1000);
});

test('API catalogue and rules match the web catalogue exactly', () => {
  assert.equal(MERCH_ITEMS.length, web.MERCH.length);
  for (const w of web.MERCH) {
    const a = findItem(w.id);
    assert.ok(a, `missing in API: ${w.id}`);
    assert.equal(a.price_cents, Math.round(w.price * 100), `${w.id} price`);
    assert.equal(a.sold_out, w.soldOut, `${w.id} sold out`);
    assert.equal(a.name, w.name);
    assert.equal(a.category, w.category);
    assert.equal(isSized(a.category), web.isSized(w), `${w.id} sized`);
  }
  assert.deepEqual([web.POINTS_PER_BLOCK, web.BLOCK_CENTS, web.SIGNATURE_POINTS, web.MAX_QTY], [POINTS_PER_BLOCK, BLOCK_CENTS, SIGNATURE_POINTS, MAX_QTY]);
  assert.deepEqual(web.SIZES, SIZES);
  for (const c of [0, 999, 1000, 3999, 6120, 123456]) assert.equal(web.pointsEarned(c), pointsEarned(c));
});

test('catalogue ids are unique and prices are whole cents', () => {
  assert.equal(new Set(MERCH_ITEMS.map((m) => m.id)).size, MERCH_ITEMS.length);
  for (const m of MERCH_ITEMS) assert.ok(Number.isInteger(m.price_cents) && m.price_cents > 0, m.id);
});

test('ledger accepts the new merch source types, and orders store no personal details', () => {
  const sources = validators.point_transactions.properties.source_type.enum;
  assert.ok(sources.includes('merch_purchase') && sources.includes('signature'));
  const props = Object.keys(validators.orders.properties);
  for (const pii of ['email', 'address', 'shipping', 'customer_name']) assert.ok(!props.includes(pii), pii);
  assert.equal(validators.orders.properties.qty.maximum, MAX_QTY);
});
