import { ObjectId } from 'mongodb';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { applyPoints } from './ledger.js';
import { BATCH_SIZE, POINTS_PER_BATCH, findShort, historyKey, rankShorts, rewardProgress } from './shortsRank.js';

const MAX_FRIENDS = 100;
const MIN_VIEW_GAP_MS = 1_500; // the client counts a view after ~3s on a card; this is the server-side floor

async function interestsOf(user) {
  const games = await col('user_games').find({ user_id: user._id }).project({ game_name: 1, _id: 0 }).toArray();
  return { games: games.map((g) => g.game_name), teams: user.faze_teams_followed ?? [], players: user.favorite_players ?? [] };
}

export async function getFeed(user) {
  const friendIds = (user.friends ?? []).filter((f) => f instanceof ObjectId).slice(0, MAX_FRIENDS);
  const [me, friendDocs, friendGames, friendLikes, myViews, myLikes, allLikes] = await Promise.all([
    interestsOf(user),
    friendIds.length ? col('users').find({ _id: { $in: friendIds } }, { projection: { user_name: 1, faze_teams_followed: 1, favorite_players: 1 } }).toArray() : [],
    friendIds.length ? col('user_games').find({ user_id: { $in: friendIds } }).project({ user_id: 1, game_name: 1, _id: 0 }).toArray() : [],
    friendIds.length ? col('short_likes').find({ user_id: { $in: friendIds } }).project({ user_id: 1, short_id: 1, _id: 0 }).toArray() : [],
    col('short_views').find({ user_id: user._id }).project({ short_id: 1, _id: 0 }).toArray(),
    col('short_likes').find({ user_id: user._id }).project({ short_id: 1, _id: 0 }).toArray(),
    col('short_likes').aggregate([{ $group: { _id: '$short_id', n: { $sum: 1 } } }]).toArray(),
  ]);

  const byFriend = (rows, pick) => {
    const m = new Map();
    for (const r of rows) m.set(String(r.user_id), [...(m.get(String(r.user_id)) ?? []), r[pick]]);
    return m;
  };
  const gamesBy = byFriend(friendGames, 'game_name');
  const likesBy = byFriend(friendLikes, 'short_id');
  const friends = friendDocs.map((f) => ({
    name: f.user_name ?? 'A friend',
    games: gamesBy.get(String(f._id)) ?? [],
    teams: f.faze_teams_followed ?? [],
    players: f.favorite_players ?? [],
    liked: likesBy.get(String(f._id)) ?? [],
  }));

  const likeCounts = new Map(allLikes.map((l) => [l._id, l.n]));
  const ranked = rankShorts({ me, friends, seen: new Set(myViews.map((v) => v.short_id)), liked: new Set(myLikes.map((l) => l.short_id)) });
  return {
    shorts: ranked.map((r) => ({ ...r.short, reasons: r.reasons, friend_likers: r.likers, seen: r.seen, liked: r.liked, like_count: likeCounts.get(r.short.id) ?? 0 })),
    progress: rewardProgress(user.shorts_viewed ?? 0),
  };
}

// Counts one unique view and pays POINTS_PER_BATCH on every BATCH_SIZE-th unique short. The view row, the
// counter and the points commit together; the unique (user_id, short_id) index makes a repeat view a no-op,
// so a short can only ever count once per user.
export async function recordView(user, shortId) {
  const short = findShort(shortId);
  if (!short) throw new HttpError(404, 'Short not found');
  const last = await col('short_views').findOne({ user_id: user._id }, { sort: { viewed_at: -1 }, projection: { viewed_at: 1 } });
  if (last && Date.now() - last.viewed_at.getTime() < MIN_VIEW_GAP_MS) throw new HttpError(429, 'Slow down. Watch a short before moving on.');

  try {
    return await withTxn(async (session) => {
      await col('short_views').insertOne({ user_id: user._id, short_id: shortId, video_id: historyKey(short), viewed_at: new Date() }, { session });
      const { shorts_viewed: viewed } = await col('users').findOneAndUpdate(
        { _id: user._id },
        { $inc: { shorts_viewed: 1 }, $addToSet: { watched_history: historyKey(short) } },
        { session, returnDocument: 'after', projection: { shorts_viewed: 1 } },
      );
      let awarded = 0;
      if (viewed % BATCH_SIZE === 0) {
        await applyPoints(session, { userId: user._id, delta: POINTS_PER_BATCH, sourceType: 'shorts_bonus' });
        awarded = POINTS_PER_BATCH;
      }
      return { counted: true, awarded, progress: rewardProgress(viewed) };
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return { counted: false, awarded: 0, progress: rewardProgress(user.shorts_viewed ?? 0) };
  }
}

// Toggles a like. Friends' likes feed back into their friends' rankings.
export async function toggleLike(user, shortId) {
  if (!findShort(shortId)) throw new HttpError(404, 'Short not found');
  const { deletedCount } = await col('short_likes').deleteOne({ user_id: user._id, short_id: shortId });
  if (!deletedCount) {
    try {
      await col('short_likes').insertOne({ user_id: user._id, short_id: shortId, created_at: new Date() });
    } catch (err) {
      if (err.code !== 11000) throw err; // a concurrent request already liked it
    }
  }
  const [liked, like_count] = await Promise.all([
    col('short_likes').countDocuments({ user_id: user._id, short_id: shortId }).then(Boolean),
    col('short_likes').countDocuments({ short_id: shortId }),
  ]);
  return { liked, like_count };
}

// The viewer's most recently watched shorts, newest first, for the profile page.
export async function getRecent(user, limit) {
  const rows = await col('short_views').find({ user_id: user._id }).sort({ viewed_at: -1 }).limit(limit).toArray();
  return rows.flatMap((r) => {
    const s = findShort(r.short_id);
    return s ? [{ id: s.id, title: s.title, creator: s.creator, game: s.game, thumb: s.thumb, url: s.url, platform: s.platform, viewed_at: r.viewed_at }] : [];
  });
}
