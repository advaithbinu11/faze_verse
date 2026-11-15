import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://localhost/test';
process.env.JWT_SECRET ??= 'x'.repeat(32);
process.env.API_BASE_URL ??= 'http://localhost:3000';
process.env.FRONTEND_URL ??= 'http://localhost:5173';

const { computePayout, decideSettlement } = await import('../src/services/payout.js');
const { validators } = await import('../src/schemas.js');

test('winners split the whole pool pro rata', () => {
  // pool 1000, team_a staked 400 -> a 100 stake pays 250
  assert.equal(computePayout(100, 400, 1000), 250);
  assert.equal(computePayout(300, 400, 1000), 750);
});

test('payout never exceeds the pool and survives int32-sized values', () => {
  const big = 2 ** 31 - 1;
  assert.equal(computePayout(big, big, big), big);
  assert.equal(computePayout(1, 3, 10), 3); // floor
});

test('empty winning pool refunds everyone', () => {
  const s = decideSettlement({ status: 'completed', winner: 'team_b', team_b_points: 0, total_points_invested: 500 });
  assert.equal(s.refundAll, true);
});

test('cancelled event refunds everyone', () => {
  const s = decideSettlement({ status: 'cancelled', winner: null, team_a_points: 5, total_points_invested: 5 });
  assert.equal(s.refundAll, true);
});

test('normal settlement reports the multiplier', () => {
  const s = decideSettlement({ status: 'completed', winner: 'team_a', team_a_points: 250, total_points_invested: 1000 });
  assert.deepEqual(s, { refundAll: false, winnerPool: 250, multiplier: 4 });
});

test('every collection has a validator with required fields', () => {
  for (const name of ['users', 'events', 'parties', 'point_transactions']) {
    assert.ok(validators[name].required.length > 0, name);
  }
});
