import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { config } from '../config.js';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { signToken } from '../middleware/auth.js';
import { applyPoints } from '../services/ledger.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../services/password.js';
import { HEX_COLOR, randomColor } from '../services/colors.js';
import { saveGames } from '../services/userModel.js';
import * as steam from '../services/steam.js';
import { exchangeCode, linkingEnabled, syncDiscordParties, verifyState } from '../services/discordLink.js';
import { joinGuild } from '../services/discord.js';

const router = Router();

const email = z.string().trim().toLowerCase().email().max(254);
const signupSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(30, 'Use 30 characters or fewer'),
  email,
  password: z.string().min(10, 'Use at least 10 characters').max(128, 'Use 128 characters or fewer'),
  // SteamID64: 17 digits starting 7656119. Empty string means "skip".
  steam_id: z.string().trim().regex(/^7656119\d{10}$/, 'Enter the 17-digit Steam ID (starts with 7656119)').or(z.literal('')).optional(),
  favorite_players: z.array(z.string().trim().regex(/^[\w .\-]{1,30}$/, 'Use letters, numbers, spaces, . _ -')).max(10, 'Pick up to 10').default([]),
  // Omitted means "pick one for me".
  profile_color: z.string().trim().toLowerCase().regex(HEX_COLOR, 'Pick a valid color').optional(),
}).strict();
const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

// Creates the account, its welcome bonus and the ledger row in one transaction.
router.post('/signup', async (req, res) => {
  const { name, email: addr, password, steam_id, favorite_players, profile_color } = signupSchema.parse(req.body);
  const password_hash = await hashPassword(password);

  let user;
  try {
    user = await withTxn(async (session) => {
      const doc = {
        user_name: name, email: addr, password_hash, role: 'user', faze_points: 0,
        watched_history: [], faze_teams_followed: [], regions: [], created_at: new Date(),
        favorite_players: [...new Set(favorite_players)],
        profile_color: profile_color ?? randomColor(),
        ...(steam_id && { steam_id_unverified: steam_id }),
      };
      const { insertedId } = await col('users').insertOne(doc, { session });
      if (config.points.signupBonus > 0) {
        await applyPoints(session, { userId: insertedId, delta: config.points.signupBonus, sourceType: 'signup_bonus' });
      }
      return { ...doc, _id: insertedId };
    });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An account with this email already exists', { fieldErrors: { email: ['Already registered. Try signing in.'] } });
    throw err;
  }
  res.status(201).json({ token: signToken(user) });
});

router.post('/login', async (req, res) => {
  const { email: addr, password } = loginSchema.parse(req.body);
  const user = await col('users').findOne({ email: addr });
  // Always run one hash comparison, and use one message, so neither timing nor wording reveals which emails exist.
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');
  res.json({ token: signToken(user) });
});

router.get('/steam', (_req, res) => res.redirect(steam.buildLoginUrl()));

router.get('/steam/callback', async (req, res) => {
  const steamId = await steam.verifyAssertion(req.query);
  const [profile, games] = await Promise.all([
    steam.getProfile(steamId),
    // A private library must not block login.
    steam.getOwnedGames(steamId).catch(() => []),
  ]);

  const isAdmin = config.adminSteamIds.includes(steamId);
  const result = await col('users').updateOne(
    { steam_id: steamId },
    {
      $set: {
        avatar: profile.avatar,
        profile_url: profile.profile_url,
        steam_synced_at: new Date(),
        ...(isAdmin && { role: 'admin' }),
      },
      $setOnInsert: {
        user_name: profile.name, // set once; an existing account keeps the name it already has
        faze_points: config.points.signupBonus,
        watched_history: [],
        faze_teams_followed: [],
        regions: [],
        profile_color: randomColor(),
        created_at: new Date(),
        ...(!isAdmin && { role: 'user' }),
      },
    },
    { upsert: true },
  );

  const user = await col('users').findOne({ steam_id: steamId });
  await saveGames(user._id, games);
  if (result.upsertedId && config.points.signupBonus > 0) {
    await col('point_transactions').insertOne({
      user_id: user._id,
      points: config.points.signupBonus,
      balance_after: config.points.signupBonus,
      source_type: 'signup_bonus',
      timestamp: new Date(),
    });
  }

  // Token goes in the fragment so it never reaches server logs or Referer headers.
  res.redirect(`${config.frontendUrl}/auth/callback#token=${signToken(user)}`);
});

// Discord redirects here after the player approves. The signed state says which account is linking.
router.get('/discord/callback', async (req, res) => {
  const back = (result) => res.redirect(`${config.frontendUrl}/profile?discord=${result}`);
  if (!linkingEnabled() || req.query.error || !req.query.code) return back('cancelled');
  let userId;
  try {
    userId = verifyState(String(req.query.state ?? ''));
  } catch {
    return back('expired');
  }
  try {
    const { accessToken, id, username } = await exchangeCode(String(req.query.code));
    const taken = await col('users').findOne({ discord_id: id, _id: { $ne: new ObjectId(userId) } }, { projection: { _id: 1 } });
    if (taken) return back('taken');
    const user = await col('users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { discord_id: id, discord_username: username, discord_linked_at: new Date() } },
      { returnDocument: 'after' },
    );
    if (!user) return back('expired');
    await joinGuild(id, accessToken); // must be in the server before channel access can be granted
    await syncDiscordParties(user);
    back('linked');
  } catch (err) {
    console.error('Discord link failed:', err.message);
    back('error');
  }
});

export default router;
