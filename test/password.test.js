import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../src/services/password.js';

test('hash verifies the right password and rejects a wrong one', async () => {
  const h = await hashPassword('correct horse battery');
  assert.ok(h.startsWith('scrypt$32768$8$1$'));
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('correct horse batterz', h), false);
});

test('same password hashes differently each time (random salt)', async () => {
  assert.notEqual(await hashPassword('same-password-1'), await hashPassword('same-password-1'));
});

test('malformed stored hashes fail closed', async () => {
  assert.equal(await verifyPassword('x', 'plaintext'), false);
  assert.equal(await verifyPassword('x', ''), false);
});

test('dummy hash is a valid hash that no real input matches', async () => {
  assert.equal(await verifyPassword('anything', DUMMY_HASH), false);
});
