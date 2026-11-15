import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isEpicGame } from '../src/services/games.js';
import { CODE_PATTERN, DISCOUNT_KINDS, PERKS, findPerk, newCode, publicPerk, publicRedemption } from '../src/services/perks.js';
import { validators } from '../src/schemas.js';

test('catalogue ids are unique and costs are positive integers', () => {
  assert.equal(new Set(PERKS.map((p) => p.id)).size, PERKS.length);
  for (const p of PERKS) assert.ok(Number.isInteger(p.cost) && p.cost > 0, p.id);
});

test('every perk kind is allowed by the redemptions validator', () => {
  const allowed = validators.redemptions.properties.kind.enum;
  for (const p of PERKS) assert.ok(allowed.includes(p.kind), `${p.id}: ${p.kind}`);
});

test('discount perks carry the fields checkout needs', () => {
  const discounts = PERKS.filter((p) => DISCOUNT_KINDS.includes(p.kind));
  assert.ok(discounts.length >= 3);
  for (const p of discounts) {
    if (p.kind === 'merch_percent') assert.ok(p.percent > 0 && p.percent <= 100, p.id);
    else assert.ok(p.amount_cents > 0 && p.min_spend_cents >= p.amount_cents, p.id); // minimum spend always exceeds the discount
  }
  assert.ok(PERKS.filter((p) => !DISCOUNT_KINDS.includes(p.kind)).every((p) => !p.percent && !p.amount_cents));
});

test('codes match the pattern, avoid look-alike characters, and do not repeat', () => {
  const codes = Array.from({ length: 2000 }, newCode);
  assert.ok(codes.every((c) => CODE_PATTERN.test(c)));
  assert.ok(codes.every((c) => !/[01OI]/.test(c.slice(3))));
  assert.equal(new Set(codes).size, codes.length);
});

test('code pattern rejects malformed input', () => {
  for (const bad of ['', 'FZ-ABCD', 'fz-abcd-2345', 'FZ-ABCD-23450', 'FZ-AB0D-2345', 'XX-ABCD-2345']) assert.equal(CODE_PATTERN.test(bad), false, bad);
});

test('public shapes expose no internals', () => {
  assert.deepEqual(Object.keys(publicPerk(findPerk('wallpaper'))).sort(), ['body', 'category', 'cost', 'id', 'kind', 'title']);
  const r = publicRedemption({ _id: 'x', user_id: 'u', perk_id: 'merch-10', title: 't', kind: 'merch_percent', cost: 300, code: 'FZ-ABCD-2345', status: 'active', percent: 10, created_at: new Date() });
  assert.equal(r.usable, true);
  assert.ok(!('user_id' in r));
  assert.equal(publicRedemption({ ...r, _id: 'x', status: 'used' }).usable, false);
  assert.equal(publicRedemption({ _id: 'y', kind: 'raffle', status: 'active' }).usable, false);
});

test('Epic Games Store titles skip the Steam ownership rule', () => {
  for (const g of ['Fortnite', 'fortnite', '  FORTNITE ', 'Rocket League']) assert.equal(isEpicGame(g), true, g);
  for (const g of ['Counter-Strike 2', 'Dota 2', 'Valorant', '', undefined, null]) assert.equal(isEpicGame(g), false, String(g));
});
