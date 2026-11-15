require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const {
  DISCORD_TOKEN,
  GUILD_ID,
  PARTY_CATEGORY_ID,
  STAFF_ROLE_ID,
  API_KEY,
  MONGODB_URI,
  MONGODB_DB = 'faze_connect',
  PLATFORM_DB = 'faze_platform;', // the website's database (the name really ends in a semicolon)
  PARTY_MAX_SIZE = '5',
  EMPTY_TTL_MIN = '10',
  PORT = 3000,
} = { ...require('./config'), ...process.env };

for (const [k, v] of Object.entries({ DISCORD_TOKEN, GUILD_ID, API_KEY })) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const EMPTY_TTL_MS = Math.max(1, Number(EMPTY_TTL_MIN) || 10) * 60 * 1000;
const SNOWFLAKE = /^\d{17,20}$/;

for (const [k, v] of Object.entries({ GUILD_ID, PARTY_CATEGORY_ID, STAFF_ROLE_ID })) {
  if (v && !SNOWFLAKE.test(String(v))) {
    console.error(`${k} must be a Discord ID (17-20 digits), got: ${v}`);
    process.exit(1);
  }
}
const PARTY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const GAMES = {
  fortnite: 'Fortnite',
  halo: 'Halo',
  overwatch: 'Overwatch',
  valorant: 'VALORANT',
  rocket_league: 'Rocket League',
};

// ---------- party store: in-memory cache, persisted to Mongo when configured ----------
// Doc shape: { _id: partyId, channelId, game, hostDiscordId, members: [discordId], status: 'active'|'closed', createdAt }
const parties = new Map(); // partyId -> doc
const byChannel = new Map(); // channelId -> partyId
let col = null;
let platform = null; // website database handle, used by the backfill

async function initStore() {
  if (!MONGODB_URI) {
    console.warn('No MONGODB_URI: parties are kept in memory only and are lost on restart.');
    return;
  }
  const { MongoClient } = require('mongodb');
  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  col = mongo.db(MONGODB_DB).collection('discord_parties');
  platform = mongo.db(PLATFORM_DB);
  for (const d of await col.find({ status: 'active' }).toArray()) index(d);
  console.log(`Loaded ${parties.size} active parties from MongoDB`);
}

function index(doc) {
  parties.set(doc._id, doc);
  byChannel.set(doc.channelId, doc._id);
}

async function persist(doc) {
  index(doc);
  if (col) await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
}

// ---------- helpers ----------
const memberPerms = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.UseVAD,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
];

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function channelUrl(channelId) {
  return `https://discord.com/channels/${GUILD_ID}/${channelId}`;
}

// Drops the website party's link once its channel is gone, so the site never shows a dead link.
// Matches on the exact URL, so a link that was already replaced by a newer channel is left alone.
async function clearSiteLink(partyId, channelId) {
  if (!platform) return;
  await platform
    .collection('parties')
    .updateOne({ _id: partyId, discord_channel_link: channelUrl(channelId) }, { $unset: { discord_channel_link: '' } })
    .catch((err) => console.error(`clearing link for ${partyId} failed:`, err.message));
}

function present(doc) {
  return {
    partyId: doc._id,
    channelId: doc.channelId,
    url: channelUrl(doc.channelId),
    game: doc.game,
    host: doc.hostDiscordId,
    members: doc.members,
    status: doc.status,
  };
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal error' });
  });

// ---------- discord ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const emptyTimers = new Map(); // channelId -> timeout

function cancelTimer(channelId) {
  clearTimeout(emptyTimers.get(channelId));
  emptyTimers.delete(channelId);
}

function scheduleEmptyClose(channelId) {
  cancelTimer(channelId);
  emptyTimers.set(
    channelId,
    setTimeout(async () => {
      emptyTimers.delete(channelId);
      const partyId = byChannel.get(channelId);
      if (!partyId || parties.get(partyId)?.persistent) return;
      try {
        const ch = await client.channels.fetch(channelId).catch(() => null);
        if (ch && ch.members.size > 0) return; // someone joined in the meantime
        await closeParty(partyId);
        console.log(`Closed empty party ${partyId}`);
      } catch (err) {
        console.error('auto-close failed:', err);
      }
    }, EMPTY_TTL_MS)
  );
}

async function getGuild() {
  return client.guilds.fetch(GUILD_ID);
}

async function createParty({ partyId, game, hostDiscordId, memberDiscordIds, maxSize, name, requireHost = true, persistent = false }) {
  const guild = await getGuild();

  const existing = parties.get(partyId);
  if (existing && existing.status === 'active') {
    const ch = await guild.channels.fetch(existing.channelId).catch(() => null);
    if (ch) return { doc: existing, created: false, notInServer: [] };
  }

  const wanted = [...new Set([hostDiscordId, ...memberDiscordIds].filter(Boolean))];
  const found = [];
  const notInServer = [];
  for (const id of wanted) {
    const m = await guild.members.fetch(id).catch(() => null);
    (m ? found : notInServer).push(id);
  }
  if (requireHost && !found.includes(hostDiscordId)) throw httpError(404, 'Host is not a member of the server');

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
    ...found.map((id) => ({ id, allow: memberPerms })),
    {
      id: client.user.id,
      allow: [
        ...memberPerms,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.MoveMembers,
      ],
    },
  ];
  if (STAFF_ROLE_ID) overwrites.push({ id: STAFF_ROLE_ID, allow: memberPerms });

  const host = hostDiscordId && found.includes(hostDiscordId) ? await guild.members.fetch(hostDiscordId) : null;
  const label = name || `${host ? host.user.username : 'open'}'s party`;
  const channel = await guild.channels.create({
    name: `${Object.hasOwn(GAMES, game) ? GAMES[game] : game} | ${label}`.slice(0, 100),
    type: ChannelType.GuildVoice,
    parent: PARTY_CATEGORY_ID || undefined,
    userLimit: maxSize,
    permissionOverwrites: overwrites,
    reason: `FaZe // CONNECT party ${partyId}`,
  });

  const doc = {
    _id: partyId,
    channelId: channel.id,
    game,
    hostDiscordId: hostDiscordId || null,
    members: found,
    status: 'active',
    createdAt: new Date(),
    ...(persistent && { persistent }),
  };
  await persist(doc);
  scheduleEmptyClose(channel.id); // cleans up parties nobody ever joins
  return { doc, created: true, notInServer };
}

async function closeParty(partyId) {
  const doc = parties.get(partyId);
  if (!doc) throw httpError(404, 'Party not found');
  cancelTimer(doc.channelId);
  const guild = await getGuild();
  const ch = await guild.channels.fetch(doc.channelId).catch(() => null);
  if (ch) await ch.delete(`FaZe // CONNECT party ${partyId} closed`);
  doc.status = 'closed';
  doc.closedAt = new Date();
  if (col) await col.replaceOne({ _id: partyId }, doc, { upsert: true });
  parties.delete(partyId);
  byChannel.delete(doc.channelId);
  await clearSiteLink(partyId, doc.channelId);
  return doc;
}

function getActive(partyId) {
  const doc = parties.get(partyId);
  if (!doc || doc.status !== 'active') throw httpError(404, 'Party not found');
  return doc;
}

async function addMember(partyId, discordUserId) {
  const doc = getActive(partyId);
  const guild = await getGuild();
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (!member) throw httpError(404, 'User is not a member of the server');
  const ch = await guild.channels.fetch(doc.channelId).catch(() => null);
  if (!ch) throw httpError(410, 'Party channel no longer exists');
  await ch.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    UseVAD: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });
  if (!doc.members.includes(discordUserId)) doc.members.push(discordUserId);
  await persist(doc);
  return doc;
}

async function removeMember(partyId, discordUserId) {
  const doc = getActive(partyId);
  const guild = await getGuild();
  const ch = await guild.channels.fetch(doc.channelId).catch(() => null);
  if (ch) await ch.permissionOverwrites.delete(discordUserId).catch(() => {});
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (member && member.voice.channelId === doc.channelId) await member.voice.disconnect().catch(() => {});
  doc.members = doc.members.filter((id) => id !== discordUserId);
  await persist(doc);
  return doc;
}

// ---------- backfill: give every existing website party a real Discord channel ----------
// Idempotent: createParty reuses a live channel for the same partyId, so reruns only repair links.
// Website users usually have no linked Discord account yet, so channels are created without a host;
// members get access later through the normal join flow once they link Discord.
const personId = (p) => (typeof p === 'string' ? p : p?.user_id);
const guildChannelLink = new RegExp(`^https://discord\\.com/channels/${GUILD_ID}/\\d{17,20}$`);

async function backfillParties({ dryRun = false } = {}) {
  if (!platform) throw httpError(503, 'MONGODB_URI is not configured');
  const guild = await getGuild();
  const maxSize = Math.min(99, Math.max(2, Number(PARTY_MAX_SIZE) || 5));
  const siteParties = await platform.collection('parties').find().toArray();
  const userIds = [...new Set(siteParties.flatMap((p) => (p.people || []).map(personId).filter(Boolean)))];
  const discordIds = new Map(
    (await platform.collection('users').find({ _id: { $in: userIds } }).project({ discord_id: 1 }).toArray())
      .filter((u) => u.discord_id)
      .map((u) => [String(u._id), u.discord_id])
  );

  const results = [];
  for (const party of siteParties) {
    const partyId = String(party._id);
    const game = party.game_playing || 'Party';
    try {
      const live = parties.get(partyId);
      const liveChannel = live?.status === 'active' && (await guild.channels.fetch(live.channelId).catch(() => null));
      if (liveChannel && party.discord_channel_link === channelUrl(live.channelId)) {
        results.push({ partyId, game, action: 'skipped', url: party.discord_channel_link });
        continue;
      }
      if (dryRun) {
        results.push({ partyId, game, action: 'would-create', replacing: party.discord_channel_link || null });
        continue;
      }
      const linked = (party.people || []).map(personId).map((id) => discordIds.get(String(id))).filter(Boolean);
      const { doc, created, notInServer } = await createParty({
        partyId,
        game,
        hostDiscordId: linked[0],
        memberDiscordIds: linked.slice(1),
        maxSize,
        name: partyId,
        requireHost: false,
        persistent: true,
      });
      if (!doc.persistent) {
        doc.persistent = true;
        await persist(doc);
      }
      const url = channelUrl(doc.channelId);
      await platform.collection('parties').updateOne({ _id: party._id }, { $set: { discord_channel_link: url } });
      results.push({ partyId, game, action: created ? 'created' : 'relinked', url, replaced: party.discord_channel_link || null, notInServer });
    } catch (err) {
      console.error(`backfill ${partyId} failed:`, err.message);
      results.push({ partyId, game, action: 'failed', error: err.message });
    }
  }
  return results;
}

// A channel deleted by hand in Discord: close the party record and clear the website link.
client.on('channelDelete', async (channel) => {
  const partyId = byChannel.get(channel.id);
  const doc = partyId && parties.get(partyId);
  if (!doc) return; // not ours, or closeParty already handled it
  cancelTimer(channel.id);
  parties.delete(partyId);
  byChannel.delete(channel.id);
  doc.status = 'closed';
  doc.closedAt = new Date();
  try {
    if (col) await col.replaceOne({ _id: partyId }, doc, { upsert: true });
  } catch (err) {
    console.error('channelDelete persist failed:', err.message);
  }
  await clearSiteLink(partyId, channel.id);
  console.log(`Channel for party ${partyId} was deleted in Discord; link cleared`);
});

client.on('voiceStateUpdate', (oldS, newS) => {
  if (newS.channelId && byChannel.has(newS.channelId)) cancelTimer(newS.channelId);
  if (oldS.channelId && oldS.channelId !== newS.channelId && byChannel.has(oldS.channelId)) {
    if (oldS.channel && oldS.channel.members.size === 0) scheduleEmptyClose(oldS.channelId);
  }
});

// ---------- api ----------
const app = express();
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => res.json({ ok: client.isReady() }));

app.use('/api', (req, res, next) => {
  if (!safeEqual(req.get('x-api-key') || '', API_KEY)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!client.isReady()) return res.status(503).json({ error: 'Bot not ready' });
  next();
});

// Create a party (idempotent on partyId)
app.post('/api/parties', wrap(async (req, res) => {
  const { partyId, game, hostDiscordId, memberDiscordIds = [], maxSize = 5, name } = req.body || {};
  if (!PARTY_ID.test(String(partyId || ''))) throw httpError(400, 'partyId must be 1-64 chars of letters, digits, _ or -');
  if (typeof game !== 'string' || !game.trim() || game.length > 60) throw httpError(400, 'game must be a game name up to 60 chars');
  if (!SNOWFLAKE.test(String(hostDiscordId || ''))) throw httpError(400, 'hostDiscordId must be a Discord user ID');
  if (!Array.isArray(memberDiscordIds) || memberDiscordIds.length > 98 || memberDiscordIds.some((i) => !SNOWFLAKE.test(String(i)))) {
    throw httpError(400, 'memberDiscordIds must be an array of Discord user IDs');
  }
  if (!Number.isInteger(maxSize) || maxSize < 2 || maxSize > 99) throw httpError(400, 'maxSize must be an integer from 2 to 99');
  if (name !== undefined && (typeof name !== 'string' || name.length > 60)) throw httpError(400, 'name must be a string up to 60 chars');

  const { doc, created, notInServer } = await createParty({ partyId, game, hostDiscordId, memberDiscordIds, maxSize, name });
  res.status(created ? 201 : 200).json({ created, ...present(doc), notInServer });
}));

app.get('/api/parties/:partyId', wrap(async (req, res) => {
  res.json(present(getActive(req.params.partyId)));
}));

// Let a user into a party
app.post('/api/parties/:partyId/members', wrap(async (req, res) => {
  const { discordUserId } = req.body || {};
  if (!SNOWFLAKE.test(String(discordUserId || ''))) throw httpError(400, 'discordUserId must be a Discord user ID');
  res.json(present(await addMember(req.params.partyId, discordUserId)));
}));

// Remove a user (also disconnects them if they're in the channel)
app.delete('/api/parties/:partyId/members/:discordUserId', wrap(async (req, res) => {
  if (!SNOWFLAKE.test(req.params.discordUserId)) throw httpError(400, 'Invalid Discord user ID');
  res.json(present(await removeMember(req.params.partyId, req.params.discordUserId)));
}));

// Add a user to the server using their OAuth2 token (guilds.join scope); a no-op if they are already in it
app.post('/api/guild/members', wrap(async (req, res) => {
  const { discordUserId, accessToken } = req.body || {};
  if (!SNOWFLAKE.test(String(discordUserId || ''))) throw httpError(400, 'discordUserId must be a Discord user ID');
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 200) throw httpError(400, 'accessToken is required');
  const guild = await getGuild();
  const already = await guild.members.fetch(discordUserId).catch(() => null);
  if (!already) await guild.members.add(discordUserId, { accessToken });
  res.json({ ok: true, alreadyMember: Boolean(already) });
}));

// Create Discord channels for every party already in the website database (?dryRun=1 to preview)
app.post('/api/backfill', wrap(async (req, res) => {
  const results = await backfillParties({ dryRun: ['1', 'true'].includes(String(req.query.dryRun)) });
  const tally = {};
  for (const r of results) tally[r.action] = (tally[r.action] || 0) + 1;
  res.json({ tally, results });
}));

// Close a party and delete its channel
app.delete('/api/parties/:partyId', wrap(async (req, res) => {
  const doc = await closeParty(req.params.partyId);
  res.json({ partyId: doc._id, status: doc.status });
}));

// ---------- boot ----------
(async () => {
  await initStore();
  client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    // Re-check parties restored from the database
    for (const doc of [...parties.values()]) {
      const ch = await client.channels.fetch(doc.channelId).catch(() => null);
      if (!ch) {
        doc.status = 'closed';
        if (col) await col.replaceOne({ _id: doc._id }, doc);
        parties.delete(doc._id);
        byChannel.delete(doc.channelId);
        await clearSiteLink(doc._id, doc.channelId);
      } else if (ch.members.size === 0) {
        scheduleEmptyClose(doc.channelId);
      }
    }
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  });
  await client.login(DISCORD_TOKEN);
})();
