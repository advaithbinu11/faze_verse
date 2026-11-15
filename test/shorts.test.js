import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validators } from '../src/schemas.js';
import { BATCH_SIZE, CATALOG, POINTS_PER_BATCH, gameOf, rankShorts, rewardProgress } from '../src/services/shortsRank.js';

const none = { games: [], teams: [], players: [] };
const friend = (o) => ({ name: 'vex', games: [], teams: [], players: [], liked: [], ...o });

test('catalogue ids are unique and every short has a game and a link', () => {
  assert.equal(new Set(CATALOG.map((s) => s.id)).size, CATALOG.length);
  for (const s of CATALOG) assert.ok(s.game && s.title && s.url, s.id);
});

test('the shorts ledger source is allowed by the validator', () => {
  assert.ok(validators.point_transactions.properties.source_type.enum.includes('shorts_bonus'));
});

test('games and teams map onto catalogue games', () => {
  assert.equal(gameOf('Counter-Strike 2'), 'Counter-Strike 2');
  assert.equal(gameOf('FaZe CS2'), 'Counter-Strike 2');
  assert.equal(gameOf('VALORANT'), 'Valorant');
  assert.equal(gameOf('Dota 2'), null);
});

test('your own games lead the feed', () => {
  const ranked = rankShorts({ me: { ...none, games: ['Valorant'] }, friends: [] });
  assert.equal(ranked[0].short.game, 'Valorant');
  assert.match(ranked[0].reasons[0].text, /You play Valorant/);
});

test('what friends like outranks a game match, and says who liked it', () => {
  const target = CATALOG.find((s) => s.game === 'Fortnite');
  const ranked = rankShorts({ me: { ...none, games: ['Valorant'] }, friends: [friend({ liked: [target.id] }), friend({ name: 'tess', liked: [target.id] })] });
  assert.equal(ranked[0].short.id, target.id);
  assert.equal(ranked[0].reasons[0].text, 'Liked by vex and 1 more');
});

test('seen shorts sink to the bottom but stay in the feed', () => {
  const seen = new Set(CATALOG.filter((s) => s.game === 'Apex Legends').map((s) => s.id));
  const ranked = rankShorts({ me: { ...none, games: ['Apex Legends'] }, friends: [], seen });
  assert.equal(ranked.length, CATALOG.length);
  assert.ok(ranked.slice(-seen.size).every((r) => r.seen));
});

test('with no interest signal the feed mixes games instead of running one game', () => {
  const ranked = rankShorts({ me: none, friends: [] });
  const firstFour = ranked.slice(0, 4).map((r) => r.short.game);
  assert.ok(new Set(firstFour).size > 1);
});

test('reward progress: 10 points every 5 shorts', () => {
  assert.equal(POINTS_PER_BATCH, 10);
  assert.equal(BATCH_SIZE, 5);
  assert.equal(rewardProgress(0).next_reward_in, 5);
  assert.equal(rewardProgress(4).next_reward_in, 1);
  assert.equal(rewardProgress(5).next_reward_in, 5);
  assert.equal(rewardProgress(7).next_reward_in, 3);
});
