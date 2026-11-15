import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MERCH } from '../web/src/data/merch.js';
import { pickForYou } from '../web/src/data/merchPicks.js';

const day = 'Sun Nov 15 2026';

test('the strip defaults to 5 picks', () => {
  assert.equal(pickForYou({ _id: 'u1' }, undefined, day).length, 5);
});

test('picks are in stock, unique and capped', () => {
  const picks = pickForYou({ _id: 'u1', teams_followed: [], favorite_players: [] }, 10, day);
  assert.equal(picks.length, 10);
  assert.equal(new Set(picks.map((p) => p.item.id)).size, 10);
  assert.ok(picks.every((p) => !p.item.soldOut));
});

test('picks are stable for a player on a given day and differ between players', () => {
  const ids = (u) => pickForYou(u, 10, day).map((p) => p.item.id).join();
  assert.equal(ids({ _id: 'u1' }), ids({ _id: 'u1' }));
  assert.notEqual(ids({ _id: 'u1' }), ids({ _id: 'u2' }));
});

test('following CS2 puts Counter Strike and Cybear pieces first, with the reason', () => {
  const picks = pickForYou({ _id: 'u1', teams_followed: ['FaZe CS2'] }, 10, day);
  const first = picks.filter((p) => p.reason?.startsWith('For your'));
  assert.ok(first.length > 0);
  assert.ok(first.every((p) => /counter strike|cybear/i.test(p.item.name)));
  assert.equal(picks[0].reason, 'For your FaZe CS2');
});

test('sale items surface when nothing matches, and the strip spreads across categories', () => {
  const picks = pickForYou({ _id: 'u9' }, 10, day);
  assert.ok(picks.some((p) => p.reason === 'On sale'));
  assert.ok(new Set(picks.map((p) => p.item.category)).size >= 4);
  assert.ok(MERCH.length >= picks.length);
});
