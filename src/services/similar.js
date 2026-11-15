import { col } from '../db.js';

// Ported from find_similiar_users/server.js. Scoring is unchanged:
//   score = shared games x WEIGHT_GAME + shared followed teams x WEIGHT_TEAM
// Candidates must own at least one game you own; your existing friends and you are excluded.
export const WEIGHT_GAME = 2;
export const WEIGHT_TEAM = 3;

export async function findSimilarUsers(me, limit) {
  const myGameNames = (await col('user_games').find({ user_id: me._id }).project({ game_name: 1, _id: 0 }).toArray()).map((g) => g.game_name);
  if (!myGameNames.length) return [];
  const myTeams = me.faze_teams_followed ?? [];
  const myFriends = me.friends ?? [];

  return col('user_games')
    .aggregate([
      { $match: { game_name: { $in: myGameNames }, user_id: { $ne: me._id } } },
      { $group: { _id: '$user_id', shared_games: { $push: '$game_name' }, shared_game_count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { _id: { $nin: myFriends } } },
      { $addFields: { shared_teams: { $setIntersection: [{ $ifNull: ['$user.faze_teams_followed', []] }, myTeams] } } },
      { $addFields: { score: { $add: [{ $multiply: ['$shared_game_count', WEIGHT_GAME] }, { $multiply: [{ $size: '$shared_teams' }, WEIGHT_TEAM] }] } } },
      { $sort: { score: -1, 'user.faze_points': -1, _id: 1 } }, // _id keeps ties stable between calls
      { $limit: limit },
      {
        $project: {
          _id: 0,
          user_id: '$_id',
          user_name: '$user.user_name',
          profile_color: { $ifNull: ['$user.profile_color', null] },
          online: { $eq: ['$user.online', true] },
          shared_games: 1,
          shared_teams: 1,
          score: 1,
          // discord_channel is deliberately not returned: it is contact info other users did not agree to publish.
        },
      },
    ])
    .toArray();
}
