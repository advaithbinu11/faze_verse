import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { col } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import * as steam from '../services/steam.js';
import { HEX_COLOR } from '../services/colors.js';
import { findSimilarUsers } from '../services/similar.js';
import { saveGames, toPublicUser, toStoredProfile } from '../services/userModel.js';
import { buildAuthorizeUrl, linkingEnabled, syncDiscordParties } from '../services/discordLink.js';

const router = Router();
router.use(requireAuth);

const needSteam = (user) => {
  if (!user.steam_id) throw new HttpError(400, 'Sign in with Steam to link your account first');
};

router.get('/me', async (req, res) => res.json(await toPublicUser(req.user)));

const profileSchema = z
  .object({
    teams_followed: z.array(z.string().trim().min(1).max(50)).max(20),
    favorite_players: z.array(z.string().trim().regex(/^[\w .\-]{1,30}$/)).max(10),
    regions: z.array(z.string().trim().min(1).max(20)).max(10),
    profile_color: z.string().trim().toLowerCase().regex(HEX_COLOR),
    discord_id: z.string().regex(/^\d{15,25}$/),
    discord_channel: z.string().regex(/^\d{15,25}$/),
  })
  .partial()
  .strict();

router.patch('/me', async (req, res) => {
  const update = profileSchema.parse(req.body);
  if (!Object.keys(update).length) throw new HttpError(400, 'No fields to update');
  if (update.regions) update.regions = update.regions.map((r) => r.toUpperCase());
  // With OAuth configured the id must be verified through "Link Discord"; typing one in would let anyone claim another account.
  if (update.discord_id && linkingEnabled()) throw new HttpError(400, 'Use "Link Discord" to connect your account');
  await col('users').updateOne({ _id: req.user._id }, { $set: toStoredProfile(update) });
  const saved = await col('users').findOne({ _id: req.user._id });
  if (update.discord_id) await syncDiscordParties(saved);
  res.json(await toPublicUser(saved));
});

// Starts the Discord OAuth flow. Returns the URL instead of redirecting because the browser cannot send the bearer token on a redirect.
router.post('/me/discord/link', (req, res) => {
  if (!linkingEnabled()) throw new HttpError(503, 'Discord linking is not configured');
  res.json({ url: buildAuthorizeUrl(req.user._id) });
});

// Players similar to a user (shared games and followed teams), best match first. Same access rule as friends.
router.get('/:userId/similar', async (req, res) => {
  const { userId } = req.params;
  if (userId !== 'me' && !ObjectId.isValid(userId)) throw new HttpError(400, 'Invalid userId');
  const id = userId === 'me' ? req.user._id : new ObjectId(userId);
  if (!id.equals(req.user._id) && req.user.role !== 'admin') throw new HttpError(403, 'You can only view your own matches');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const me = id.equals(req.user._id) ? req.user : await col('users').findOne({ _id: id });
  if (!me) throw new HttpError(404, 'User not found');
  res.json({ user_id: String(id), matches: await findSimilarUsers(me, limit) });
});

// Friends of a user: name, profile color and online status, looked up from each friend's user id.
// :userId may be 'me'. You can only read your own list (admins can read any).
router.get('/:userId/friends', async (req, res) => {
  const { userId } = req.params;
  if (userId !== 'me' && !ObjectId.isValid(userId)) throw new HttpError(400, 'Invalid user id');
  const id = userId === 'me' ? req.user._id : new ObjectId(userId);
  if (!id.equals(req.user._id) && req.user.role !== 'admin') throw new HttpError(403, 'You can only view your own friends');

  const owner = id.equals(req.user._id) ? req.user : await col('users').findOne({ _id: id }, { projection: { friends: 1 } });
  if (!owner) throw new HttpError(404, 'User not found');

  const friendIds = (owner.friends ?? []).filter((f) => f instanceof ObjectId).slice(0, 100);
  const docs = friendIds.length
    ? await col('users').find({ _id: { $in: friendIds } }, { projection: { user_name: 1, profile_color: 1, online: 1 } }).toArray()
    : [];
  res.json(
    docs
      .map((f) => ({ id: f._id, name: f.user_name ?? 'Unknown', profile_color: f.profile_color ?? null, online: f.online === true }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
  );
});

// ---- Other players' pages -------------------------------------------------------------------
// Only fields a player shows on their own page are returned; email, Steam/Discord ids and the points
// ledger are never exposed to other users.
const MAX_FRIENDS = 500;
const friendCard = (f) => ({ id: f._id, name: f.user_name ?? 'Unknown', profile_color: f.profile_color ?? null, online: f.online === true });
const byOnlineThenName = (a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name);
const isFriendOf = (viewer, id) => (viewer.friends ?? []).some((f) => f instanceof ObjectId && f.equals(id));

// :userId may be 'me'. Any signed-in player can read another player's page.
router.get('/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  if (userId !== 'me' && !ObjectId.isValid(userId)) throw new HttpError(400, 'Invalid user id');
  const id = userId === 'me' ? req.user._id : new ObjectId(userId);
  const isSelf = id.equals(req.user._id);
  const target = isSelf ? req.user : await col('users').findOne({ _id: id });
  if (!target) throw new HttpError(404, 'User not found');

  const friendIds = (target.friends ?? []).filter((f) => f instanceof ObjectId).slice(0, 100);
  const [games, myGames, friendDocs] = await Promise.all([
    col('user_games').find({ user_id: id }).project({ game_name: 1, hours: 1, _id: 0 }).sort({ hours: -1, game_name: 1 }).toArray(),
    isSelf ? null : col('user_games').find({ user_id: req.user._id }).project({ game_name: 1, _id: 0 }).toArray(),
    friendIds.length ? col('users').find({ _id: { $in: friendIds } }, { projection: { user_name: 1, profile_color: 1, online: 1 } }).toArray() : [],
  ]);

  const mine = new Set((myGames ?? games).map((g) => g.game_name));
  const myTeams = new Set(req.user.faze_teams_followed ?? []);
  const teams = target.faze_teams_followed ?? [];
  res.json({
    id: target._id,
    name: target.user_name ?? 'Unknown',
    profile_color: target.profile_color ?? null,
    online: target.online === true,
    faze_points: target.faze_points ?? 0,
    teams_followed: teams,
    favorite_players: target.favorite_players ?? [],
    games: games.map((g) => ({ name: g.game_name, hours: g.hours ?? null })),
    friends: friendDocs.map(friendCard).sort(byOnlineThenName),
    friend_count: (target.friends ?? []).length,
    shared_games: isSelf ? [] : games.map((g) => g.game_name).filter((n) => mine.has(n)),
    shared_teams: isSelf ? [] : teams.filter((t) => myTeams.has(t)),
    is_self: isSelf,
    is_friend: !isSelf && isFriendOf(req.user, id),
  });
});

const addFriendSchema = z.object({ user_id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid user id') }).strict();

// Adds a player to your friends list. Idempotent: adding someone twice is a no-op, not an error.
router.post('/me/friends', async (req, res) => {
  const { user_id } = addFriendSchema.parse(req.body);
  const id = new ObjectId(user_id);
  if (id.equals(req.user._id)) throw new HttpError(400, 'You cannot add yourself as a friend');
  const target = await col('users').findOne({ _id: id }, { projection: { user_name: 1, profile_color: 1, online: 1 } });
  if (!target) throw new HttpError(404, 'User not found');
  if (isFriendOf(req.user, id)) return res.json({ friend: friendCard(target), added: false });
  if ((req.user.friends ?? []).length >= MAX_FRIENDS) throw new HttpError(409, `You can have up to ${MAX_FRIENDS} friends`);
  await col('users').updateOne({ _id: req.user._id }, { $addToSet: { friends: id } });
  res.status(201).json({ friend: friendCard(target), added: true });
});

router.post('/me/steam/sync', async (req, res) => {
  needSteam(req.user);
  const [profile, games] = await Promise.all([steam.getProfile(req.user.steam_id), steam.getOwnedGames(req.user.steam_id)]);
  await col('users').updateOne({ _id: req.user._id }, { $set: { avatar: profile.avatar, steam_synced_at: new Date() } });
  await saveGames(req.user._id, games);
  res.json({ games: games.length, library_public: profile.visibility === 3 });
});

router.get('/me/steam/inventory', async (req, res) => {
  needSteam(req.user);
  const { appId } = z.object({ appId: z.coerce.number().int().positive().default(730) }).parse(req.query);
  const inventory = await steam.getInventory(req.user.steam_id, appId);
  if (!inventory) throw new HttpError(403, 'Steam inventory is private');
  res.json(inventory);
});

router.get('/me/transactions', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) }).parse(req.query);
  const rows = await col('point_transactions').find({ user_id: req.user._id }).sort({ timestamp: -1 }).limit(limit).toArray();
  res.json(rows);
});

export default router;
