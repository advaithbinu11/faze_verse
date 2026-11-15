import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ||= 'x'.repeat(40);
process.env.MONGODB_URI ||= 'mongodb://localhost:27017/test';
process.env.DISCORD_CLIENT_ID = '123';
process.env.DISCORD_CLIENT_SECRET = 'secret';
const { signState, verifyState, buildAuthorizeUrl, linkingEnabled } = await import('../src/services/discordLink.js');
const { config } = await import('../src/config.js');

test('state round-trips the user id', () => {
  assert.equal(verifyState(signState('abc')), 'abc');
});

test('a login token is not accepted as link state', () => {
  const loginToken = jwt.sign({ role: 'user' }, config.jwt.secret, { subject: 'abc' });
  assert.throws(() => verifyState(loginToken));
});

test('authorize url asks for identify + guilds.join and carries state', () => {
  assert.ok(linkingEnabled());
  const url = new URL(buildAuthorizeUrl('abc'));
  assert.equal(url.searchParams.get('scope'), 'identify guilds.join');
  assert.equal(verifyState(url.searchParams.get('state')), 'abc');
});
