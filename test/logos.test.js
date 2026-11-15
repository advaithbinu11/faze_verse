import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { validators } from '../src/schemas.js';
import { BACKDROPS, LOGOS, LOGO_COST, MIN_CONTRAST, PAIRINGS, contrast } from '../src/services/logos.js';

test('every logo image ships with the web app', () => {
  for (const l of LOGOS) assert.ok(existsSync(new URL(`../web/public${l.image}`, import.meta.url)), l.image);
});

test('every offered pairing keeps the mark readable on its backdrop', () => {
  for (const p of PAIRINGS) {
    const logo = LOGOS.find((l) => l.id === p.logo_id);
    assert.ok(BACKDROPS.includes(p.backdrop));
    assert.ok(contrast(logo.ink, p.backdrop) >= MIN_CONTRAST, `${p.logo_id} on ${p.backdrop}`);
  }
});

test('each logo has several backdrops, so a re-roll has somewhere to go', () => {
  for (const l of LOGOS) assert.ok(PAIRINGS.filter((p) => p.logo_id === l.id).length >= 4, l.id);
});

test('the purchase price and ledger source are wired up', () => {
  assert.equal(LOGO_COST, 2000);
  assert.ok(validators.point_transactions.properties.source_type.enum.includes('logo_purchase'));
  assert.ok(validators.profile_logos.required.includes('backdrop'));
});
