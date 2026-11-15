import { col } from '../db.js';
import { isEpicGame } from './games.js';

// The existing `users` collection predates this API, so its field names win:
//   user_name (API: name), faze_teams_followed (API: teams_followed), steam_id, epic_id, faze_points.
// Owned games live in `user_games` ({ user_id, game_name, hours }), not embedded on the user.

export async function toPublicUser(u) {
  const { password_hash, user_name, faze_teams_followed, ...rest } = u; // never expose the hash
  return {
    ...rest,
    name: user_name ?? '',
    teams_followed: faze_teams_followed ?? [],
    regions: u.regions ?? [],
    favorite_players: u.favorite_players ?? [],
    steam_game_count: await col('user_games').countDocuments({ user_id: u._id }),
  };
}

// Maps API profile fields onto stored field names.
export const toStoredProfile = ({ teams_followed, ...rest }) => ({
  ...rest,
  ...(teams_followed && { faze_teams_followed: teams_followed }),
});

const hoursFromMinutes = (m) => Math.round((m / 60) * 10) / 10;

// Upserts one row per game and removes games the user no longer owns. An empty list means the
// library is private or the call failed, so existing rows are left alone.
export async function saveGames(userId, games) {
  if (!games.length) return;
  await col('user_games').bulkWrite([
    ...games.map((g) => ({
      updateOne: {
        filter: { user_id: userId, game_name: g.name },
        update: { $set: { hours: hoursFromMinutes(g.playtime_forever), appid: g.appid } },
        upsert: true,
      },
    })),
    { deleteMany: { filter: { user_id: userId, game_name: { $nin: games.map((g) => g.name) } } } },
  ]);
}

export const ownsGame = (userId, gameName) => col('user_games').findOne({ user_id: userId, game_name: gameName }, { projection: { _id: 1 } });

// Whether a player may join parties for a game: Steam games need a library entry; Epic Games Store titles
// cannot be checked against Steam, so they are open to everyone.
export const canPlay = async (userId, gameName) => isEpicGame(gameName) || Boolean(await ownsGame(userId, gameName));
