// In-memory implementation of the data layer. Same signatures as real.js, so screens never care which is active.
import { MERCH, MAX_QTY, SIGNATURE_POINTS, isSized, pointsEarned } from './merch.js';
import SHORTS from './shorts.json';
import { LOGO_COST, PAIRINGS } from './logos.js';
import { seedSimilar, seedFriends, seedClusters, seedEvents, seedParties, seedPerks, seedPosts, seedUpdates, seedUser } from './seed.js';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms + Math.random() * 150));
const clone = (v) => structuredClone(v);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chunk = () => Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const newCode = () => `FZ-${chunk()}-${chunk()}`;
const DISCOUNT_KINDS = ['merch_percent', 'merch_amount'];
const fail = (status, message) => Object.assign(new Error(message), { status });

const db = {
  user: clone(seedUser),
  events: clone(seedEvents),
  parties: clone(seedParties),
  posts: clone(seedPosts),
  perks: clone(seedPerks),
  redemptions: [],
  predictions: {},
  transactions: [{ _id: 't0', points: 1000, balance_after: 1000, source_type: 'signup_bonus', timestamp: new Date().toISOString() }],
  userPosts: 0,
  logos: [], // purchased profile logos
  partyBonusDay: null,
  activeLogo: null,
  shortsSeen: new Map(), // id -> ISO time, in watch order
  shortsLiked: new Set(),
  accounts: new Map(),
};

const PARTY_BONUS = 5;
// First party joined or started each day pays PARTY_BONUS points, like the API.
const partyBonus = () => {
  const day = new Date().toISOString().slice(0, 10);
  if (db.partyBonusDay === day) return 0;
  db.partyBonusDay = day;
  ledger(PARTY_BONUS, 'party_bonus');
  return PARTY_BONUS;
};
const ledger = (points, source_type, extra = {}) => {
  db.user.faze_points += points;
  db.transactions.unshift({ _id: crypto.randomUUID(), points, balance_after: db.user.faze_points, source_type, timestamp: new Date().toISOString(), ...extra });
};
const withOdds = (e) => ({ ...e, odds: { team_a: e.team_a_points ? e.total_points_invested / e.team_a_points : null, team_b: e.team_b_points ? e.total_points_invested / e.team_b_points : null } });

const SHORTS_BATCH = 5, SHORTS_POINTS = 10;
const shortsProgress = (viewed) => ({ viewed, batch_size: SHORTS_BATCH, points: SHORTS_POINTS, next_reward_in: SHORTS_BATCH - (viewed % SHORTS_BATCH) });
// Demo friends' tastes. Mirrors the API's ranking (own games > friends' likes > friends' games) without sharing its code.
const DEMO_FRIEND_LIKES = { s03: ['clutch_kai'], s14: ['clutch_kai', 'nova_strike'], s22: ['ember_fox'], s31: ['nova_strike'] };
const DEMO_FRIEND_GAMES = { 'Counter-Strike 2': 2, Fortnite: 3, 'Apex Legends': 1, Valorant: 1 };

const DEMO_FACTS = [
  { fact: 'FaZe Red took 3rd at the Call of Duty Championship in March 2015, the first time the org climbed onto a championship podium.', angle: 'FaZe Call of Duty' },
  { fact: 'The crew started in May 2010 as FaZe Sniping, three Call of Duty trickshotters uploading to YouTube.', angle: 'Origins' },
];
const pickDemoFact = () => ({ ...DEMO_FACTS[Math.floor(Math.random() * DEMO_FACTS.length)], created_at: new Date().toISOString() });

export const fake = {
  mode: 'demo',
  // Demo accounts live in memory only; same error shapes as the API so form handling is identical.
  async signup({ name, email, password, steam_id, favorite_players = [], profile_color }) {
    await wait();
    if (db.accounts.has(email)) throw Object.assign(fail(409, 'An account with this email already exists'), { details: { fieldErrors: { email: ['Already registered. Try signing in.'] } } });
    db.user = { ...clone(seedUser), _id: crypto.randomUUID(), name, email, faze_points: 1000, steam_id: undefined, steam_game_count: 0, steam_games: [], steam_id_unverified: steam_id || undefined, favorite_players, profile_color: profile_color ?? '#e4002b', friends: [], teams_followed: [], regions: [] };
    db.accounts.set(email, { password, user: db.user });
    return { token: 'demo' };
  },
  async login({ email, password }) {
    await wait();
    const acct = db.accounts.get(email);
    if (!acct || acct.password !== password) throw fail(401, 'Email or password is incorrect');
    db.user = acct.user;
    return { token: 'demo' };
  },
  async getMe() { await wait(); return clone({ ...db.user, profile_logo: db.logos.find((l) => l.id === db.activeLogo) ?? null }); },
  async updateProfile(patch) { await wait(); Object.assign(db.user, patch); return clone(db.user); },
  // Demo mode has no RAG backend: a handful of hand-written facts from the club's history, rotated at random.
  async getFunFact() { await wait(); return clone(pickDemoFact()); },
  async newFunFact() { await wait(); return clone(pickDemoFact()); },
  async getSimilar(_userId, limit = 5) { await wait(); return { matches: clone(seedSimilar).slice(0, limit) }; },
  async getFriendGames() {
    await wait();
    const friends = db.user.friends ?? seedFriends;
    const by = (id) => friends.find((f) => f.id === id);
    const plays = { 'Counter-Strike 2': ['f1', 'f2'], Valorant: ['f2'], Fortnite: ['f1', 'f3'], 'Apex Legends': ['f3'], 'Rocket League': ['f1'], 'Call of Duty': [] };
    const mine = new Set(db.user.steam_games.map((g) => g.name));
    return clone(Object.entries(plays).map(([game, ids]) => ({
      game, mine: mine.has(game),
      friends: ids.map(by).filter(Boolean).sort((a, b) => Number(b.online) - Number(a.online)),
    })));
  },
  async getFriends() { await wait(); return clone(db.user.friends ?? seedFriends); },
  // Demo directory of other players, built from the friend and suggestion seeds.
  async getProfile(userId) {
    await wait();
    const friends = db.user.friends ?? seedFriends;
    const card = friends.find((f) => f.id === userId);
    const match = seedSimilar.find((s) => s.user_id === userId);
    if (userId === db.user._id) throw fail(400, 'That is your own page');
    if (!card && !match) throw fail(404, 'User not found');
    const games = match?.shared_games ?? ['Counter-Strike 2'];
    return clone({
      id: userId, name: card?.name ?? match.user_name, profile_color: card?.profile_color ?? match.profile_color, online: card?.online ?? match.online,
      faze_points: 640, teams_followed: match?.shared_teams.length ? match.shared_teams : ['FaZe'], favorite_players: [],
      games: games.map((name) => ({ name, hours: null })), friends: friends.filter((f) => f.id !== userId).slice(0, 3), friend_count: 3,
      shared_games: games.filter((g) => db.user.steam_games.some((x) => x.name === g)), shared_teams: ['FaZe'],
      is_self: false, is_friend: Boolean(card),
    });
  },
  async addFriend(userId) {
    await wait();
    const m = seedSimilar.find((s) => s.user_id === userId);
    if (!m) throw fail(404, 'User not found');
    db.user.friends ??= clone(seedFriends);
    if (!db.user.friends.some((f) => f.id === userId)) db.user.friends.push({ id: userId, name: m.user_name, profile_color: m.profile_color, online: m.online });
    return { friend: { id: userId, name: m.user_name, profile_color: m.profile_color, online: m.online }, added: true };
  },
  async listTransactions() { await wait(); return clone(db.transactions); },

  async listEvents({ status } = {}) {
    await wait();
    // Demo only: other fans keep predicting, so odds drift between polls.
    for (const e of db.events.filter((x) => x.status !== 'completed')) {
      const side = Math.random() < 0.5 ? 'team_a_points' : 'team_b_points';
      const add = Math.floor(Math.random() * 120);
      e[side] += add; e.total_points_invested += add;
    }
    return clone(db.events.filter((e) => !status || e.status === status)).map(withOdds);
  },
  async getMyPrediction(eventId) { await wait(120); return clone(db.predictions[eventId] ?? null); },
  async placePrediction(eventId, { team, points }) {
    await wait();
    const e = db.events.find((x) => x.event_id === eventId);
    if (!e || e.status !== 'upcoming') throw fail(409, 'Event is not open for predictions');
    if (db.predictions[eventId]) throw fail(409, 'You already predicted this event');
    if (points > db.user.faze_points) throw fail(402, 'Insufficient points');
    e[`${team}_points`] += points; e.total_points_invested += points;
    ledger(-points, 'prediction', { event_id: eventId });
    return (db.predictions[eventId] = { event_id: eventId, team, points, status: 'pending', created_at: new Date().toISOString() });
  },
  async listUpdates() { await wait(120); return clone(seedUpdates); },

  async startWatch(videoId) { await wait(120); return { session_id: crypto.randomUUID(), video_id: videoId, duration_seconds: 120, points: 40 }; },
  async watchEvent(sessionId, { state, position }) {
    await wait(80);
    const awarded = state === 'ENDED' && position > 100 && !db.user.watched_history.includes('demo') ? 40 : 0;
    if (awarded) { db.user.watched_history.push('demo'); ledger(awarded, 'watch_time'); }
    return { state, awarded };
  },

  async listClusters() {
    await wait();
    const mine = new Set(db.user.steam_games.map((g) => g.name));
    const openFor = (name) => db.parties
      .filter((p) => p.game_name === name && p.num_people < 5 && !p.people.includes(db.user._id))
      .map(({ party_id, game_id, region, num_people }) => ({ party_id, game_id, region, num_people }));
    const rows = seedClusters.map((c) => ({ ...c, owned: mine.has(c.game_name), open_parties: openFor(c.game_name) }));
    return clone(rows.sort((a, b) => Number(b.owned) - Number(a.owned) || b.players - a.players));
  },
  async listParties() { await wait(); return clone(db.parties); },
  async createParty({ game_id, region }) {
    await wait();
    const game = db.user.steam_games.find((g) => String(g.appid) === game_id) ?? { name: game_id };
    const party = { party_id: crypto.randomUUID(), game_id, game_name: game.name, region: region ?? 'GLOBAL', num_people: 1, people: [db.user._id] };
    db.parties.push(party);
    return { ...clone(party), bonus: partyBonus() };
  },
  async matchParty({ game_id, region }) {
    await wait();
    const game = db.user.steam_games.find((g) => String(g.appid) === game_id) ?? { name: game_id };
    const open = db.parties.find((p) => p.game_id === game_id && p.num_people < 5 && !p.people.includes(db.user._id));
    if (open) { open.people.push(db.user._id); open.num_people += 1; return { ...clone(open), bonus: partyBonus() }; }
    const party = { party_id: crypto.randomUUID(), game_id, game_name: game.name, region: region ?? 'GLOBAL', num_people: 1, people: [db.user._id] };
    db.parties.push(party);
    return { ...clone(party), bonus: partyBonus() };
  },
  async joinParty(id) {
    await wait();
    const p = db.parties.find((x) => x.party_id === id);
    if (!p || p.num_people >= 5 || p.people.includes(db.user._id)) throw fail(409, 'Party is full or you already joined');
    p.people.push(db.user._id); p.num_people += 1;
    return { ...clone(p), bonus: partyBonus() };
  },
  async leaveParty(id) {
    await wait();
    const p = db.parties.find((x) => x.party_id === id);
    if (!p?.people.includes(db.user._id)) throw fail(404, 'You are not in this party');
    p.people = p.people.filter((x) => x !== db.user._id); p.num_people -= 1;
    if (!p.num_people) db.parties = db.parties.filter((x) => x !== p);
  },

  async listPosts() { await wait(); return clone(db.posts); },
  async createPost(text) {
    await wait();
    const post = { id: crypto.randomUUID(), author: { id: db.user._id, name: db.user.name, profile_color: db.user.profile_color }, text, likes: 0, liked: false, at: new Date().toISOString(), comments: [] };
    db.posts.unshift(post);
    const bonus = db.userPosts++ < 3 ? 3 : 0;
    if (bonus) ledger(bonus, 'watch_time');
    return { post: clone(post), bonus };
  },
  async toggleLike(id) {
    await wait(100);
    const p = db.posts.find((x) => x.id === id);
    p.liked = !p.liked; p.likes += p.liked ? 1 : -1;
    return { likes: p.likes, liked: p.liked };
  },
  async addComment(id, text) {
    await wait(100);
    const p = db.posts.find((x) => x.id === id);
    const comment = { id: crypto.randomUUID(), author: { id: db.user._id, name: db.user.name, profile_color: db.user.profile_color }, text, at: new Date().toISOString() };
    p.comments.push(comment);
    return clone(comment);
  },

  async listLogos() { await wait(); return clone({ cost: LOGO_COST, owned: db.logos, active_id: db.activeLogo, total: PAIRINGS.length }); },
  async buyLogo() {
    await wait();
    const choices = PAIRINGS.filter((p) => !db.logos.some((l) => l.logo_id === p.logo_id && l.backdrop === p.backdrop));
    if (!choices.length) throw fail(409, 'You already own every profile logo');
    if (db.user.faze_points < LOGO_COST) throw fail(402, 'Insufficient points');
    ledger(-LOGO_COST, 'logo_purchase');
    const pick = choices[Math.floor(Math.random() * choices.length)];
    const logo = { id: crypto.randomUUID(), ...pick, created_at: new Date().toISOString() };
    db.logos.unshift(logo);
    return { logo: clone(logo), balance: db.user.faze_points };
  },
  async setActiveLogo(id) {
    await wait(100);
    if (id !== null && !db.logos.some((l) => l.id === id)) throw fail(404, 'You do not own that logo');
    db.activeLogo = id;
    return { active_id: id };
  },
  async listPerks() { await wait(); return clone(db.perks); },
  async listMyPerks() { await wait(); return clone(db.redemptions); },
  async redeemPerk(id) {
    await wait();
    const perk = db.perks.find((p) => p.id === id);
    if (!perk) throw fail(404, 'Reward not found');
    if (perk.cost > db.user.faze_points) throw fail(402, 'Insufficient points');
    ledger(-perk.cost, 'redemption');
    const { id: perk_id, title, kind, cost, percent, amount_cents, min_spend_cents } = perk;
    const redemption = { id: crypto.randomUUID(), perk_id, title, kind, cost, code: newCode(), status: 'active', usable: DISCOUNT_KINDS.includes(kind), created_at: new Date().toISOString(), ...(percent && { percent }), ...(amount_cents && { amount_cents }), ...(min_spend_cents && { min_spend_cents }) };
    db.redemptions.unshift(redemption);
    return { redemption: clone(redemption), balance: db.user.faze_points };
  },
  // Demo version of POST /merch/orders: server-side pricing, earning and the signature debit, in the same shapes.
  async placeMerchOrder({ item_id, qty, size, signed = false, code }) {
    await wait();
    const item = MERCH.find((m) => m.id === item_id);
    if (!item) throw fail(404, 'That item does not exist');
    if (item.soldOut) throw fail(409, 'That item is sold out');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw fail(400, 'Validation failed');
    if (isSized(item) && !size) throw fail(400, 'Choose a size');
    let coupon = null;
    const unit = Math.round(item.price * 100), subtotal = unit * qty;
    if (code) {
      coupon = db.redemptions.find((x) => x.code === code.trim().toUpperCase() && DISCOUNT_KINDS.includes(x.kind));
      if (!coupon) throw fail(404, 'That code was not found on your account');
      if (coupon.status !== 'active') throw fail(409, 'That code has already been used');
      if (subtotal < (coupon.min_spend_cents ?? 0)) throw fail(400, `This code needs an order of $${(coupon.min_spend_cents / 100).toFixed(2)} or more`);
    }
    const discount = !coupon ? 0 : coupon.kind === 'merch_percent' ? Math.round((subtotal * coupon.percent) / 100) : Math.min(coupon.amount_cents, subtotal);
    const total = subtotal - discount, earned = pointsEarned(total), signature = signed ? SIGNATURE_POINTS * qty : 0;
    if (signature > db.user.faze_points) throw fail(402, 'Insufficient points');
    if (coupon) { coupon.status = 'used'; coupon.usable = false; coupon.used_at = new Date().toISOString(); }
    if (signature) ledger(-signature, 'signature');
    if (earned) ledger(earned, 'merch_purchase');
    return {
      order: { number: `FZ-${chunk()}`.slice(0, 9), item_id, name: item.name, size: isSized(item) ? size : null, qty, unit_cents: unit, subtotal_cents: subtotal, discount_cents: discount, total_cents: total,
        coupon_code: discount ? coupon.code : null, points_earned: earned, signature_points: signature, signed: signature > 0, created_at: new Date().toISOString() },
      balance: db.user.faze_points,
    };
  },
  async getCoupon(code) {
    await wait(120);
    const r = db.redemptions.find((x) => x.code === code.trim().toUpperCase() && DISCOUNT_KINDS.includes(x.kind));
    if (!r) throw fail(404, 'That code was not found on your account');
    if (r.status !== 'active') throw fail(409, 'That code has already been used');
    return clone(r);
  },
  async useCoupon(code) {
    await wait(120);
    const r = db.redemptions.find((x) => x.code === code.trim().toUpperCase() && DISCOUNT_KINDS.includes(x.kind));
    if (!r) throw fail(404, 'That code was not found on your account');
    if (r.status !== 'active') throw fail(409, 'That code has already been used');
    r.status = 'used'; r.usable = false; r.used_at = new Date().toISOString();
    return clone(r);
  },
  async getShortsFeed() {
    await wait();
    const mine = new Set((db.user.steam_games ?? []).map((g) => g.name));
    const ranked = SHORTS.map((s, idx) => {
      const likers = DEMO_FRIEND_LIKES[s.id] ?? [];
      const friendsPlay = DEMO_FRIEND_GAMES[s.game] ?? 0;
      const reasons = [];
      if (likers.length) reasons.push({ kind: 'friends-liked', text: `Liked by ${likers[0]}${likers.length > 1 ? ` and ${likers.length - 1} more` : ''}` });
      if (mine.has(s.game)) reasons.push({ kind: 'game', text: `You play ${s.game}` });
      if (friendsPlay) reasons.push({ kind: 'friend-game', text: `${friendsPlay} ${friendsPlay === 1 ? 'friend plays' : 'friends play'} ${s.game}` });
      const seen = db.shortsSeen.has(s.id);
      const score = (mine.has(s.game) ? 3 : 0) + friendsPlay + likers.length * 3 - (seen ? 100 : 0);
      return { ...s, reasons, friend_likers: likers, seen, liked: db.shortsLiked.has(s.id), like_count: likers.length + (db.shortsLiked.has(s.id) ? 1 : 0), score, idx };
    }).sort((a, b) => b.score - a.score || a.idx - b.idx);
    return clone({ shorts: ranked.map(({ score, idx, ...s }) => s), progress: shortsProgress(db.shortsSeen.size) });
  },
  async viewShort(id) {
    await wait(80);
    if (!SHORTS.some((s) => s.id === id)) throw fail(404, 'Short not found');
    if (db.shortsSeen.has(id)) return { counted: false, awarded: 0, progress: shortsProgress(db.shortsSeen.size) };
    db.shortsSeen.set(id, new Date().toISOString());
    const viewed = db.shortsSeen.size;
    const awarded = viewed % SHORTS_BATCH === 0 ? SHORTS_POINTS : 0;
    if (awarded) ledger(awarded, 'shorts_bonus');
    return { counted: true, awarded, progress: shortsProgress(viewed) };
  },
  async getRecentShorts(limit = 12) {
    await wait(120);
    return [...db.shortsSeen].reverse().slice(0, limit).map(([id, viewed_at]) => {
      const { id: sid, title, creator, game, thumb, url, platform } = SHORTS.find((s) => s.id === id);
      return { id: sid, title, creator, game, thumb, url, platform, viewed_at };
    });
  },
  async likeShort(id) {
    await wait(80);
    if (db.shortsLiked.has(id)) db.shortsLiked.delete(id); else db.shortsLiked.add(id);
    return { liked: db.shortsLiked.has(id), like_count: (DEMO_FRIEND_LIKES[id]?.length ?? 0) + (db.shortsLiked.has(id) ? 1 : 0) };
  },
};
