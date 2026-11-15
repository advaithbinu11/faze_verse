import { readFileSync } from 'node:fs';

// Pure ranking for the shorts feed (no database), so it can be unit-tested. The catalogue is
// src/data/shorts.json, built from faze_videos.txt (see web/src/data/shorts.json for the demo copy).
export const CATALOG = JSON.parse(readFileSync(new URL('../data/shorts.json', import.meta.url), 'utf8'));
export const findShort = (id) => CATALOG.find((s) => s.id === id);
// What a short is called in users.watched_history and watch_videos: its YouTube id, or the catalogue id for Instagram/TikTok/X posts.
export const historyKey = (s) => s.video_id ?? s.id;
export const durationSeconds = (d) => (d ? d.split(':').reduce((t, n) => t * 60 + Number(n), 0) : 0);

export const POINTS_PER_BATCH = 10;
export const BATCH_SIZE = 5;

// Steam / team names -> the game labels used in the catalogue.
const GAME_PATTERNS = [
  ['Fortnite', /fortnite/i],
  ['Apex Legends', /apex/i],
  ['Valorant', /valorant/i],
  ['Counter-Strike 2', /counter-?strike|\bcs\s?2?\b|\bcsgo\b/i],
];
export const gameOf = (text) => GAME_PATTERNS.find(([, re]) => re.test(text ?? ''))?.[0] ?? null;

const WEIGHT = { myGame: 3, myPlayer: 4, friendGame: 1, friendPlayer: 1.5, friendLike: 3 };
const FRIEND_CAP = 5;
const SEEN_PENALTY = 100; // already-seen shorts sink to the bottom but stay in the feed so it never runs dry
const REPEAT_GAME_PENALTY = 1.5; // diversity: avoid long runs of one game

export function rewardProgress(viewed) {
  return { viewed, batch_size: BATCH_SIZE, points: POINTS_PER_BATCH, next_reward_in: BATCH_SIZE - (viewed % BATCH_SIZE) };
}

const lower = (a) => (a ?? []).map((x) => String(x).toLowerCase());

// me:      { games: [name], teams: [name], players: [name] }
// friends: [{ name, games, teams, players, liked: [shortId] }]
// state:   { seen: Set<shortId>, liked: Set<shortId> }
export function rankShorts({ me, friends, seen = new Set(), liked = new Set() }, catalog = CATALOG) {
  const myGames = new Set([...me.games, ...me.teams].map(gameOf).filter(Boolean));
  const myPlayers = new Set(lower(me.players));
  const friendGames = friends.map((f) => new Set([...f.games, ...f.teams].map(gameOf).filter(Boolean)));
  const friendPlayers = friends.map((f) => new Set(lower(f.players)));

  const scored = catalog.map((s, idx) => {
    const reasons = [];
    let score = 0;
    if (myGames.has(s.game)) { score += WEIGHT.myGame; reasons.push({ kind: 'game', text: `You play ${s.game}` }); }
    const myPlayer = s.players.find((p) => myPlayers.has(p.toLowerCase()));
    if (myPlayer) { score += WEIGHT.myPlayer; reasons.push({ kind: 'player', text: `Features ${myPlayer}, one of your favorites` }); }

    const gameFriends = friends.filter((_, i) => friendGames[i].has(s.game));
    if (gameFriends.length) {
      score += Math.min(gameFriends.length, FRIEND_CAP) * WEIGHT.friendGame;
      reasons.push({ kind: 'friend-game', text: `${gameFriends.length} ${gameFriends.length === 1 ? 'friend plays' : 'friends play'} ${s.game}` });
    }
    const playerFriends = friends.filter((_, i) => s.players.some((p) => friendPlayers[i].has(p.toLowerCase())));
    if (playerFriends.length) score += Math.min(playerFriends.length, FRIEND_CAP) * WEIGHT.friendPlayer;

    const likers = friends.filter((f) => f.liked.includes(s.id)).map((f) => f.name);
    if (likers.length) {
      score += Math.min(likers.length, FRIEND_CAP) * WEIGHT.friendLike;
      reasons.unshift({ kind: 'friends-liked', text: `Liked by ${likers[0]}${likers.length > 1 ? ` and ${likers.length - 1} more` : ''}` });
    }
    if (seen.has(s.id)) score -= SEEN_PENALTY;
    return { short: s, idx, score, likers, reasons, seen: seen.has(s.id), liked: liked.has(s.id) };
  });

  // Greedy pick: best remaining score, minus a penalty when it repeats the game of either of the last two picks.
  const out = [];
  const pool = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);
  while (pool.length) {
    const recent = out.slice(-2).map((o) => o.short.game);
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const adj = c.score - (recent.includes(c.short.game) ? REPEAT_GAME_PENALTY : 0);
      if (adj > bestScore) { best = i; bestScore = adj; }
    });
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}
