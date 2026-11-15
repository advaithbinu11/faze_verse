// Idempotent. Fills the fan feed with content written by rows of the `users` collection:
//   - adds extra player profiles (name, colour, followed teams, favourite players, games), never touching existing users
//   - adds posts, comments and likes from those players and the ones already there
// Seeded posts and comments carry a `seed_key`, so re-running adds nothing twice and leaves real posts alone.
// New profiles have no email, password or Steam id, so nobody can sign in as them.
// Run: npm run db:seed-feed
import { Int32 } from 'mongodb';
import * as db from '../db.js';
import { col } from '../db.js';

const NEW_USERS = [
  ['quiet_storm', '#0ea5e9', ['FaZe CS2', 'FaZe Valorant'], ['karrigan', 'Twistzz'], ['NA'], [['Counter-Strike 2', 'ranked'], ['Valorant', 'ranked']]],
  ['byte_baron', '#a855f7', ['FaZe Fortnite'], ['Mongraal', 'Nickmercs'], ['EU'], [['Fortnite', 'creative'], ['Rocket League', 'casual']]],
  ['neon_rook', '#22c55e', ['FaZe Apex'], ['Apex', 'Tfue'], ['NA'], [['Apex Legends', 'ranked'], ['Call of Duty', 'warzone']]],
  ['solar_flare_k', '#f97316', ['FaZe Call of Duty'], ['Rug', 'Jev'], ['NA'], [['Call of Duty', 'warzone'], ['Fortnite', 'zero build']]],
  ['cobalt_juno', '#2563eb', ['FaZe Valorant'], ['Sway', 'Cented'], ['APAC'], [['Valorant', 'ranked'], ['Apex Legends', 'ranked']]],
  ['drift_king', '#ef4444', ['FaZe Rocket League'], ['Banks'], ['EU'], [['Rocket League', 'ranked'], ['Fortnite', 'casual']]],
  ['pixel_pilot', '#14b8a6', ['FaZe', 'FaZe CS2'], ['ClipZ', 'Temperrr'], ['LATAM'], [['Counter-Strike 2', 'casual'], ['Valorant', 'casual']]],
  ['rogue_wren', '#ec4899', ['FaZe Valorant', 'FaZe Apex'], ['Swagg', 'Ewok'], ['NA'], [['Valorant', 'ranked'], ['Apex Legends', 'casual']]],
  ['apex_ashe', '#eab308', ['FaZe Apex'], ['Apex', 'Censor'], ['MENA'], [['Apex Legends', 'ranked']]],
  ['blitz_nomad', '#64748b', ['FaZe Call of Duty', 'FaZe'], ['Adapt', 'Clayster'], ['EU'], [['Call of Duty', 'ranked'], ['Counter-Strike 2', 'ranked']]],
  ['static_sage', '#8b5cf6', ['FaZe CS2'], ['s1mple', 'karrigan'], ['EU'], [['Counter-Strike 2', 'ranked']]],
  ['crimson_tide7', '#dc2626', ['FaZe Fortnite', 'FaZe'], ['Nickmercs', 'Sway'], ['NA'], [['Fortnite', 'creative'], ['Call of Duty', 'warzone']]],
  ['haze_runner', '#06b6d4', ['FaZe Rocket League', 'FaZe Valorant'], ['Teeqo', 'ZooMaa'], ['APAC'], [['Rocket League', 'ranked'], ['Valorant', 'casual']]],
  ['orbit_owl', '#84cc16', ['FaZe'], ['WaRTeK', 'Fakie'], ['LATAM'], [['Fortnite', 'casual'], ['Apex Legends', 'casual']]],
];

const POSTS = [
  'Anyone queueing {game} tonight? {region}, chill vibes, mics optional.',
  '{player} clips are on another level this week. Rewatched the last one four times.',
  'Hot take: {team} is the most fun roster to watch right now.',
  'That eco round call on Map 1 was unreal. Whoever made it deserves a raise.',
  'Just hit a new peak in {game}. Took way too many tilt-queues to get here.',
  'Watching the replay for the third time and I still cannot believe that clutch.',
  'Reminder that the old ILLCAMS compilations still hold up. Peak YouTube.',
  'Who else grew up on trickshot montages? {player} made me buy a headset I did not need.',
  'Looking for a fifth for {game}. Must tolerate bad jokes and worse aim.',
  'Is it just me or does {team} play best when everything looks lost?',
  'Shorts tab is dangerous. Told myself five minutes, watched twenty.',
  'Point of the day: cheering loud enough that the neighbours know the score.',
  'Anyone else grinding {game} before the next match? Drop your rank.',
  '{player} on stream last night was pure comedy. Chat never stops.',
  'Finally got my party into one voice channel without anyone muted. Small wins.',
  'Rooting for {team} this weekend. Predictions locked in, no regrets.',
  'Underrated feeling: your whole squad tabbing in at once for the match.',
  'New favourite loadout in {game} and I refuse to explain it.',
];
const COMMENTS = [
  'Same here, count me in.',
  'Could not agree more.',
  'This is the way.',
  'Run it back tomorrow?',
  'Okay that is actually a great take.',
  'I was there for that moment, still hyped.',
  'Send the clip!',
  'You are not wrong.',
  'Add me, I play {game} most nights.',
  'Bold take, but I respect it.',
  'Ha, been there. Mic check before the next round.',
  'Rewatched it too. Unreal.',
  'Locked in for the weekend.',
  'Better than the last one, honestly.',
];

// Small deterministic PRNG so the seed is the same on every run.
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let rand = mulberry32(20261115); // profiles use one stream and posts another, so a re-run picks the same posts, authors and comments
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const KEY = 'feed-seed-v1';

await db.connect();

// ---- profiles ------------------------------------------------------------------------------
let added = 0;
for (const [name, color, teams, players, regions, games] of NEW_USERS) {
  const res = await col('users').updateOne(
    { user_name: name },
    { $setOnInsert: {
      user_name: name, profile_color: color, faze_teams_followed: teams, favorite_players: players, regions, friends: [],
      online: rand() < 0.4, faze_points: new Int32(300 + Math.floor(rand() * 2500)), watched_history: [], recently_watched_look_back: '30d', seeded: true,
    } },
    { upsert: true },
  );
  if (res.upsertedCount) {
    added++;
    const user = await col('users').findOne({ user_name: name }, { projection: { _id: 1 } });
    await col('user_games').insertMany(games.map(([game_name, tlp]) => ({ user_id: user._id, game_name, hours: Math.round((20 + rand() * 700) * 10) / 10, most_recently_game_played_tlp: tlp })));
  }
}
console.log(`users: ${added} profiles added (${NEW_USERS.length - added} already existed).`);

// ---- posts, comments, likes ----------------------------------------------------------------
rand = mulberry32(777);
const users = await col('users').find({}, { projection: { user_name: 1, favorite_players: 1, faze_teams_followed: 1, regions: 1 } }).sort({ user_name: 1 }).toArray();
const gamesBy = new Map();
for (const g of await col('user_games').find({}).project({ user_id: 1, game_name: 1, _id: 0 }).toArray()) gamesBy.set(String(g.user_id), [...(gamesBy.get(String(g.user_id)) ?? []), g.game_name]);
const fill = (tpl, u) => tpl
  .replaceAll('{game}', pick(gamesBy.get(String(u._id)) ?? ['Counter-Strike 2']))
  .replaceAll('{player}', pick(u.favorite_players?.length ? u.favorite_players : ['ClipZ', 'karrigan', 'Twistzz']))
  .replaceAll('{team}', pick(u.faze_teams_followed?.length ? u.faze_teams_followed : ['FaZe']))
  .replaceAll('{region}', pick(u.regions?.length ? u.regions : ['NA']));

const DAY = 86_400_000;
const now = Date.now();
let posts = 0, comments = 0, likes = 0;
for (let i = 0; i < 48; i++) {
  const author = pick(users);
  const at = new Date(now - Math.floor(rand() * 5 * DAY) - 60_000);
  const text = fill(pick(POSTS), author).slice(0, 240);
  const res = await col('posts').updateOne({ seed_key: `${KEY}-p${i}` }, { $setOnInsert: { seed_key: `${KEY}-p${i}`, user_id: author._id, text, created_at: at } }, { upsert: true });
  posts += res.upsertedCount;
  const post = await col('posts').findOne({ seed_key: `${KEY}-p${i}` }, { projection: { _id: 1, created_at: 1 } });

  const others = users.filter((u) => String(u._id) !== String(author._id));
  const nComments = Math.floor(rand() * 5); // 0-4
  for (let j = 0; j < nComments; j++) {
    const c = pick(others);
    const cAt = new Date(post.created_at.getTime() + (j + 1) * (5 + Math.floor(rand() * 90)) * 60_000);
    const r = await col('post_comments').updateOne({ seed_key: `${KEY}-p${i}-c${j}` }, { $setOnInsert: { seed_key: `${KEY}-p${i}-c${j}`, post_id: post._id, user_id: c._id, text: fill(pick(COMMENTS), c).slice(0, 200), created_at: cAt } }, { upsert: true });
    comments += r.upsertedCount;
  }
  const nLikes = Math.floor(rand() * 9);
  for (const l of [...others].sort(() => rand() - 0.5).slice(0, nLikes)) {
    const r = await col('post_likes').updateOne({ post_id: post._id, user_id: l._id }, { $setOnInsert: { post_id: post._id, user_id: l._id, created_at: post.created_at } }, { upsert: true });
    likes += r.upsertedCount;
  }
}
console.log(`feed: ${posts} posts, ${comments} comments, ${likes} likes added.`);
await db.close();
