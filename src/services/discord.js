import { config } from '../config.js';

const API = 'https://discord.com/api/v10';

export const discordEnabled = () => Boolean(config.discord.botToken);

async function request(path, body, attempt = 0) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { authorization: `Bot ${config.discord.botToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429 && attempt < 3) {
    const { retry_after = 1 } = await res.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000)));
    return request(path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`Discord ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export function sendMessage(channelId, { content, embeds } = {}) {
  if (!discordEnabled()) throw new Error('Discord bot token is not configured');
  const roleId = config.discord.pingRoleId;
  return request(`/channels/${channelId}/messages`, {
    content: roleId && content ? `<@&${roleId}> ${content}` : content,
    embeds,
    // Only the configured role may be pinged; never @everyone/@here or user-supplied mentions.
    allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
  });
}

const eventEmbed = (event, color) => ({
  title: event.title,
  description: `**${event.team_a}** vs **${event.team_b}** · ${event.game_name}`,
  color,
  url: `${config.frontendUrl}/events/${event.event_id}`,
  timestamp: event.start_time.toISOString(),
});

export const announceReminder = (event) =>
  sendMessage(config.discord.announceChannelId, {
    content: `Match starts <t:${Math.floor(event.start_time.getTime() / 1000)}:R>. Lock in your predictions!`,
    embeds: [eventEmbed(event, 0xe10600)],
  });

export const announceMatchStart = (event) =>
  sendMessage(config.discord.announceChannelId, {
    content: 'The match is LIVE. Predictions are now closed.',
    embeds: [eventEmbed(event, 0x00c853)],
  });

// ---------- party voice channels (Faker service) ----------
export const partyChannelsEnabled = () => Boolean(config.discord.partyServiceUrl && config.discord.partyServiceKey);

async function partyRequest(method, path, body) {
  const res = await fetch(`${config.discord.partyServiceUrl}/api/parties${path}`, {
    method,
    headers: { 'x-api-key': config.discord.partyServiceKey, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Party service ${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Party channel helpers never throw: a Discord outage must not block joining or leaving a party.
const safe = (label, fn) => async (...args) => {
  if (!partyChannelsEnabled()) return null;
  try {
    return await fn(...args);
  } catch (err) {
    console.error(`Discord ${label} failed:`, err.message);
    return null;
  }
};

// Adds a verified user to the Discord server (needs their OAuth token with the guilds.join scope).
export const joinGuild = safe('guild join', (discordUserId, accessToken) =>
  fetch(`${config.discord.partyServiceUrl}/api/guild/members`, {
    method: 'POST',
    headers: { 'x-api-key': config.discord.partyServiceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ discordUserId, accessToken }),
    signal: AbortSignal.timeout(10000),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  }));

export const createPartyChannel = safe('party channel create', ({ partyId, game, hostDiscordId, maxSize }) =>
  partyRequest('POST', '', { partyId, game, hostDiscordId, maxSize }));

export const addPartyChannelMember = safe('party channel join', (partyId, discordUserId) =>
  partyRequest('POST', `/${encodeURIComponent(partyId)}/members`, { discordUserId }));

export const removePartyChannelMember = safe('party channel leave', (partyId, discordUserId) =>
  partyRequest('DELETE', `/${encodeURIComponent(partyId)}/members/${encodeURIComponent(discordUserId)}`));

export const closePartyChannel = safe('party channel close', (partyId) =>
  partyRequest('DELETE', `/${encodeURIComponent(partyId)}`));
