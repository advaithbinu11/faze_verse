// Seed script: 15 fake users + user_games + parties
// Run:  mongosh "<your connection string>" seed_fake_users.js
// Change DB_NAME to match your database.

const DB_NAME = "faze_platform;";
const conn = db.getSiblingDB(DB_NAME);

// ---------- deterministic pseudo-random (so reruns look the same) ----------
let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const digits = (n) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");

// ---------- reference data ----------
const names = [
  "faze_scout", "nova_strike", "clutch_kai", "pixel_ranger", "ghostline",
  "rift_walker", "zen_sniper", "turbo_tess", "vex_atlas", "ember_fox",
  "lag_lord", "frost_byte", "mav_rick", "silent_juno", "hype_train_hal",
];
const lookBacks = ["24h", "7d", "30d"];
const teams = ["FaZe CS2", "FaZe Valorant", "FaZe Apex", "FaZe Fortnite", "FaZe Rocket League", "FaZe Call of Duty"];
const games = [
  { name: "Apex Legends", modes: ["ranked", "pubs", "mixtape"] },
  { name: "Fortnite", modes: ["zero build", "ranked", "creative"] },
  { name: "Counter-Strike 2", modes: ["premier", "competitive", "casual"] },
  { name: "Valorant", modes: ["ranked", "unrated", "spike rush"] },
  { name: "Rocket League", modes: ["ranked 2v2", "ranked 3v3", "casual"] },
  { name: "Call of Duty: Warzone", modes: ["resurgence", "battle royale", "ranked"] },
];

// ---------- users ----------
const ids = names.map(() => new ObjectId());

const users = names.map((name, i) => {
  // mutual friendships: each user befriends i±1 and i±4 (ring layout)
  const offsets = [1, -1, 4, -4];
  const friends = offsets.map((o) => ids[(i + o + names.length) % names.length]);
  return {
    _id: ids[i],
    user_name: name,
    steam_id: "7656119" + digits(10),
    epic_id: name.replace(/_/g, ".") + ".epic",
    friends,
    online: rand() < 0.4,
    recently_watched_look_back: pick(lookBacks),
    faze_teams_followed: pickN(teams, 1 + Math.floor(rand() * 3)),
    discord_channel: "discord-" + (100 + i),
    faze_points: Math.floor(rand() * 5000),
  };
});

// ---------- user_games ----------
const userGames = [];
users.forEach((u) => {
  pickN(games, 2 + Math.floor(rand() * 3)).forEach((g) => {
    userGames.push({
      user_id: u._id,
      game_name: g.name,
      hours: Math.round((5 + rand() * 995) * 10) / 10,
      most_recently_game_played_tlp: pick(g.modes),
    });
  });
});

// ---------- parties ----------
const parties = [];
for (let p = 0; p < 5; p++) {
  const g = games[p % games.length];
  const members = pickN(ids, 1 + Math.floor(rand() * 4));
  parties.push({
    _id: "party_" + digits(3) + "abc".charAt(p % 3) + p,
    discord_channel_link: "https://discord.gg/faze" + digits(4),
    game_playing: g.name,
    people_count: members.length,
    people: members,
  });
}

// ---------- insert (removes previous fake data first so reruns are safe) ----------
conn.users.deleteMany({ user_name: { $in: names } });
conn.user_games.deleteMany({ user_id: { $in: ids } });
conn.parties.deleteMany({ people: { $in: ids } });

const r1 = conn.users.insertMany(users);
const r2 = conn.user_games.insertMany(userGames);
const r3 = conn.parties.insertMany(parties);

print(`Inserted ${Object.keys(r1.insertedIds).length} users`);
print(`Inserted ${Object.keys(r2.insertedIds).length} user_games`);
print(`Inserted ${Object.keys(r3.insertedIds).length} parties`);
