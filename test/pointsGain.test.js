import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pointsGain } from '../web/src/data/pointsGain.js';

const prev = { id: 'u1', points: 1000 };

test('only a rise in the balance counts as a gain', () => {
  assert.equal(pointsGain(prev, { _id: 'u1', faze_points: 1003 }), 3);
  assert.equal(pointsGain(prev, { _id: 'u1', faze_points: 1000 }), 0);
  assert.equal(pointsGain(prev, { _id: 'u1', faze_points: 400 }), 0); // a spend never animates
});

test('the first sighting, another account and signed-out never animate', () => {
  assert.equal(pointsGain(null, { _id: 'u1', faze_points: 5000 }), 0);
  assert.equal(pointsGain(prev, { _id: 'u2', faze_points: 5000 }), 0);
  assert.equal(pointsGain(prev, null), 0);
  assert.equal(pointsGain(prev, { _id: 'u1', faze_points: undefined }), 0);
});
