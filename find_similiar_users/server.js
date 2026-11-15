// Express version of the similar-users endpoint.
// Run: npm install && npm start      (needs Node 20.6+ and a .env file)
// Test: http://localhost:3000/users/<user _id>/similar?limit=5

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const PORT = process.env.PORT || 3000;
const DB_NAME = process.env.DB_NAME || "faze_connect";

// Tune how much each signal matters
const WEIGHT_GAME = 2;
const WEIGHT_TEAM = 3;

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10 });
await client.connect();
const db = client.db(DB_NAME);
console.log(`Connected to MongoDB database "${DB_NAME}"`);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/users/:userId/similar", async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;
    if (!ObjectId.isValid(userIdParam)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const userId = new ObjectId(userIdParam);

    // 1. The current user and their games
    const me = await db.collection("users").findOne({ _id: userId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const myGames = await db
      .collection("user_games")
      .find({ user_id: userId })
      .project({ game_name: 1, _id: 0 })
      .toArray();
    const myGameNames = myGames.map((g) => g.game_name);
    const myTeams = me.faze_teams_followed || [];
    const myFriends = me.friends || [];

    // 2. Score everyone else
    const matches = await db
      .collection("user_games")
      .aggregate([
        { $match: { game_name: { $in: myGameNames }, user_id: { $ne: userId } } },
        {
          $group: {
            _id: "$user_id",
            shared_games: { $push: "$game_name" },
            shared_game_count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $match: { _id: { $nin: myFriends } } },
        {
          $addFields: {
            shared_teams: {
              $setIntersection: [{ $ifNull: ["$user.faze_teams_followed", []] }, myTeams],
            },
          },
        },
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ["$shared_game_count", WEIGHT_GAME] },
                { $multiply: [{ $size: "$shared_teams" }, WEIGHT_TEAM] },
              ],
            },
          },
        },
        { $sort: { score: -1, "user.faze_points": -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            user_id: "$_id",
            user_name: "$user.user_name",
            online: "$user.online",
            discord_channel: "$user.discord_channel",
            shared_games: 1,
            shared_teams: 1,
            score: 1,
          },
        },
      ])
      .toArray();

    res.json({ user_id: userIdParam, matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
