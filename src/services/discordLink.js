import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { col } from '../db.js';
import { addPartyChannelMember } from './discord.js';

const API = 'https://discord.com/api/v10';

export const linkingEnabled = () => Boolean(config.discord.clientId && config.discord.clientSecret);
const redirectUri = () => `${config.apiBaseUrl}/auth/discord/callback`;

// The state ties the callback to the signed-in user and expires quickly, so it doubles as CSRF protection.
export const signState = (userId) => jwt.sign({ purpose: 'discord-link' }, config.jwt.secret, { subject: String(userId), expiresIn: '10m' });

export function verifyState(state) {
  const payload = jwt.verify(state, config.jwt.secret);
  if (payload.purpose !== 'discord-link') throw new Error('Wrong state purpose');
  return payload.sub;
}

export const buildAuthorizeUrl = (userId) =>
  `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: config.discord.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: 'identify guilds.join',
    state: signState(userId),
    prompt: 'consent',
  })}`;

export async function exchangeCode(code) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Discord token exchange failed (${res.status})`);
  const { access_token } = await res.json();
  const me = await fetch(`${API}/users/@me`, { headers: { authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000) });
  if (!me.ok) throw new Error(`Discord identity lookup failed (${me.status})`);
  const { id, username } = await me.json();
  return { accessToken: access_token, id, username };
}

// Gives a user access to the channel of every party they are already in. Safe to repeat.
export async function syncDiscordParties(user) {
  if (!user.discord_id) return 0;
  const parties = await col('parties')
    .find({ people: { $in: [user._id, String(user._id)] }, discord_channel_link: { $exists: true } })
    .project({ _id: 1 })
    .toArray();
  await Promise.all(parties.map((p) => addPartyChannelMember(p._id, user.discord_id)));
  return parties.length;
}
