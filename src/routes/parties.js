import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { col } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { addPartyChannelMember, closePartyChannel, createPartyChannel, removePartyChannelMember } from '../services/discord.js';
import { GAME_CATALOG, canonicalGame } from '../services/games.js';
import { awardPartyBonus } from '../services/partyBonus.js';

const router = Router();
router.use(requireAuth);

// Stored in the existing `parties` shape (_id, game_playing, people_count, people, discord_channel_link);
// `region` is an additive field. The API exposes the names the web app already uses. A game is
// identified by its name (user_games has no numeric id column).
const shape = ({ _id, game_playing, people_count, ...p }) => ({ ...p, party_id: _id, game_id: game_playing, game_name: game_playing, num_people: people_count });
// Adds `members` ({ id, name, profile_color }) so the board can draw each player's own avatar. Discord ids are never exposed.
async function withMembers(parties) {
  const ids = [...new Set(parties.flatMap((p) => p.people ?? []).map(String))];
  const users = ids.length
    ? await col('users').find({ _id: { $in: parties.flatMap((p) => p.people ?? []) } }, { projection: { user_name: 1, profile_color: 1 } }).toArray()
    : [];
  const byId = new Map(users.map((u) => [String(u._id), { id: u._id, name: u.user_name ?? '?', profile_color: u.profile_color ?? null }]));
  return parties.map((p) => ({ ...shape(p), members: (p.people ?? []).map((id) => byId.get(String(id))).filter(Boolean) }));
}
const unique = (arrays) => [...new Set(arrays.flat())];
const regionOf = (user, region) => region ?? user.regions?.[0] ?? 'GLOBAL';

// Other players who share a game in your library AND at least one region or followed team with you.
// With no regions/teams set it falls back to shared games only.
// Every game you own, and every catalogue game, is listed even with 0 matching players. Anyone can join or start a
// party for any game, owned or not; games you own (`owned`) are sorted first, then by matching players.
router.get('/clusters', async (req, res) => {
  const me = req.user;
  const myGames = (await col('user_games').find({ user_id: me._id }).project({ game_name: 1 }).toArray()).map((g) => g.game_name);
  const myRegions = me.regions ?? [];
  const myTeams = me.faze_teams_followed ?? [];

  const clusters = await col('user_games')
    .aggregate([
      { $match: { user_id: { $ne: me._id }, game_name: { $in: myGames } } },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { regions: 1, faze_teams_followed: 1 } }] } },
      { $unwind: '$u' },
      {
        $addFields: {
          shared_regions: { $setIntersection: [{ $ifNull: ['$u.regions', []] }, myRegions] },
          shared_teams: { $setIntersection: [{ $ifNull: ['$u.faze_teams_followed', []] }, myTeams] },
        },
      },
      ...(myRegions.length || myTeams.length
        ? [{ $match: { $or: [{ shared_regions: { $ne: [] } }, { shared_teams: { $ne: [] } }] } }]
        : []),
      { $group: { _id: '$game_name', players: { $sum: 1 }, shared_regions: { $push: '$shared_regions' }, shared_teams: { $push: '$shared_teams' } } },
      { $sort: { players: -1 } },
      { $limit: 50 },
    ])
    .toArray();

  // Games with no matching players yet: the ones you own, then the rest of the catalogue.
  const listed = new Set(clusters.map((c) => canonicalGame(c._id) ?? c._id));
  const extra = [];
  for (const name of [...myGames, ...GAME_CATALOG.map(([n]) => n)]) {
    const key = canonicalGame(name) ?? name;
    if (listed.has(key)) continue;
    listed.add(key);
    extra.push({ _id: name, players: 0, shared_regions: [], shared_teams: [] });
  }
  clusters.push(...extra);
  const owned = new Set(myGames);

  const open = (await col('parties').find({ game_playing: { $in: clusters.map((c) => c._id) }, people_count: { $lt: config.partyMaxSize }, people: { $ne: me._id } }).toArray()).map(shape);
  res.json(
    clusters.map((c) => ({
      game_id: c._id,
      game_name: c._id,
      players: c.players,
      owned: owned.has(c._id),
      shared_regions: unique(c.shared_regions),
      shared_teams: unique(c.shared_teams),
      open_parties: open.filter((p) => p.game_id === c._id).map(({ party_id, game_id, region, num_people }) => ({ party_id, game_id, region, num_people })),
    })).sort((a, b) => Number(b.owned) - Number(a.owned) || b.players - a.players),
  );
});

router.get('/', async (req, res) => {
  const q = z.object({ game_id: z.string().max(100).optional(), region: z.string().toUpperCase().optional() }).parse(req.query);
  const parties = await col('parties')
    .find({ people_count: { $lt: config.partyMaxSize }, ...(q.game_id && { game_playing: q.game_id }), ...(q.region && { region: q.region }) })
    .limit(50)
    .toArray();
  // Parties for games you own come first, then the fullest.
  const mine = new Set((await col('user_games').find({ user_id: req.user._id }).project({ game_name: 1 }).toArray()).map((g) => g.game_name));
  parties.sort((a, b) => Number(mine.has(b.game_playing)) - Number(mine.has(a.game_playing)) || b.people_count - a.people_count);
  res.json(await withMembers(parties));
});

const createSchema = z.object({
  game_id: z.string().trim().min(1).max(100),
  region: z.string().trim().toUpperCase().max(20).optional(),
  discord_channel_link: z.string().url().max(200).optional(),
});

async function createParty(user, { game_id, region, discord_channel_link }) {
  const doc = {
    _id: randomUUID(),
    game_playing: game_id,
    region: regionOf(user, region),
    people_count: 1,
    people: [user._id],
    ...(discord_channel_link && { discord_channel_link }),
    created_at: new Date(),
  };
  await col('parties').insertOne(doc);

  // Open a Discord voice channel for the party; the host needs a linked Discord account.
  if (user.discord_id && !discord_channel_link) {
    const channel = await createPartyChannel({ partyId: doc._id, game: game_id, hostDiscordId: user.discord_id, maxSize: config.partyMaxSize });
    if (channel) {
      doc.discord_channel_link = channel.url;
      await col('parties').updateOne({ _id: doc._id }, { $set: { discord_channel_link: channel.url } });
    }
  }
  return shape(doc);
}

// Gives a user access to a party's channel (no-op if the party has none or they have no Discord linked).
const grantChannelAccess = (party, user) =>
  party.discord_channel_link && user.discord_id ? addPartyChannelMember(party._id, user.discord_id) : null;

router.post('/', async (req, res) => {
  const party = await createParty(req.user, createSchema.parse(req.body));
  res.status(201).json({ ...party, bonus: await awardPartyBonus(req.user) });
});

// Joins the best open party for your game/region, or starts a new one.
router.post('/match', async (req, res) => {
  const body = createSchema.parse(req.body);
  const region = regionOf(req.user, body.region);

  const joined = await col('parties').findOneAndUpdate(
    { game_playing: body.game_id, region, people: { $ne: req.user._id }, people_count: { $lt: config.partyMaxSize } },
    { $addToSet: { people: req.user._id }, $inc: { people_count: 1 } },
    { sort: { people_count: -1 }, returnDocument: 'after' }, // fill the fullest open party first
  );
  if (joined) await grantChannelAccess(joined, req.user);
  const party = joined ?? (await col('parties').findOne({ _id: (await createParty(req.user, { ...body, region })).party_id }));
  res.json({ ...(await withMembers([party]))[0], bonus: await awardPartyBonus(req.user) });
});

router.post('/:partyId/join', async (req, res) => {
  const party = await col('parties').findOne({ _id: req.params.partyId });
  if (!party) throw new HttpError(404, 'Party not found');

  // Capacity and membership are checked in the same atomic update.
  const updated = await col('parties').findOneAndUpdate(
    { _id: party._id, people: { $ne: req.user._id }, people_count: { $lt: config.partyMaxSize } },
    { $addToSet: { people: req.user._id }, $inc: { people_count: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Party is full or you already joined');
  await grantChannelAccess(updated, req.user);
  res.json({ ...(await withMembers([updated]))[0], bonus: await awardPartyBonus(req.user) });
});

router.post('/:partyId/leave', async (req, res) => {
  const updated = await col('parties').findOneAndUpdate(
    { _id: req.params.partyId, people: req.user._id },
    { $pull: { people: req.user._id }, $inc: { people_count: -1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(404, 'You are not in this party');
  if (updated.discord_channel_link && req.user.discord_id) await removePartyChannelMember(updated._id, req.user.discord_id);
  if (updated.people_count <= 0) {
    const { deletedCount } = await col('parties').deleteOne({ _id: updated._id, people_count: { $lte: 0 } });
    if (deletedCount && updated.discord_channel_link) await closePartyChannel(updated._id);
  }
  res.status(204).end();
});

export default router;
