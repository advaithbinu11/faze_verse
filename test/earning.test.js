import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validators } from '../src/schemas.js';
import { PERKS, findPerk } from '../src/services/perks.js';
import { PARTY_BONUS } from '../src/services/partyBonus.js';
import { MS_PER_INTERVAL, POINTS_PER_INTERVAL, pointsDue } from '../src/services/twitch.js';
import { seedPerks } from '../web/src/data/seed.js';

test('watching pays 10 points for every full 30 seconds', () => {
  assert.equal(POINTS_PER_INTERVAL, 10);
  assert.equal(pointsDue(MS_PER_INTERVAL - 1, 0, 1000), 0);
  assert.equal(pointsDue(MS_PER_INTERVAL, 0, 1000), 10);
  assert.equal(pointsDue(5 * MS_PER_INTERVAL + 20_000, 0, 1000), 50);
});

test('what is already paid is not paid twice, and the daily cap holds', () => {
  assert.equal(pointsDue(5 * MS_PER_INTERVAL, 30, 1000), 20);
  assert.equal(pointsDue(5 * MS_PER_INTERVAL, 50, 1000), 0);
  assert.equal(pointsDue(10_000 * MS_PER_INTERVAL, 990, 1000), 10);
  assert.equal(pointsDue(10_000 * MS_PER_INTERVAL, 1000, 1000), 0);
});

test('the party bonus is 5 points and has its ledger source and once-a-day row', () => {
  assert.equal(PARTY_BONUS, 5);
  assert.ok(validators.point_transactions.properties.source_type.enum.includes('party_bonus'));
  assert.ok(validators.party_bonus_days.required.includes('day'));
});

test('meet your favorite FaZe streamer costs 2,000,000 points on the server and in demo mode', () => {
  assert.equal(findPerk('meet-streamer').cost, 2_000_000);
  assert.equal(seedPerks.find((p) => p.id === 'meet-streamer').cost, 2_000_000);
  assert.equal(new Set(PERKS.map((p) => p.id)).size, PERKS.length);
});
