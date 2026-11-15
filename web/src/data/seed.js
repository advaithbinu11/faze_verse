// Seed content for demo mode. Shapes match the Express API so the real client is a drop-in.
const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();

export const seedUser = {
  _id: 'demo-user',
  name: 'DemoPlayer',
  role: 'user',
  faze_points: 1200,
  profile_color: '#e4002b',
  teams_followed: ['FaZe'],
  regions: ['NA'],
  watched_history: [],
  steam_id: '76561190000000000',
  steam_game_count: 3,
  steam_games: [
    { appid: 730, name: 'Counter-Strike 2' },
    { appid: 570, name: 'Dota 2' },
    { appid: 252490, name: 'Rust' },
  ],
};

export const seedEvents = [
  { event_id: 'evt-live', title: 'Grand Final, Map 2', team_a: 'FaZe', team_b: 'Team Nova', game_name: 'Counter-Strike 2', start_time: hours(-0.5), status: 'live', total_points_invested: 18400, team_a_points: 11200, team_b_points: 7200 },
  { event_id: 'evt-next', title: 'Semifinal', team_a: 'FaZe', team_b: 'Northwind', game_name: 'Counter-Strike 2', start_time: hours(26), status: 'upcoming', total_points_invested: 5200, team_a_points: 2600, team_b_points: 2600 },
  { event_id: 'evt-later', title: 'Group Stage, Day 3', team_a: 'FaZe', team_b: 'Ironclad', game_name: 'Rocket League', start_time: hours(72), status: 'upcoming', total_points_invested: 900, team_a_points: 700, team_b_points: 200 },
];

export const seedClusters = [
  { game_id: '730', game_name: 'Counter-Strike 2', players: 184, shared_regions: ['NA'], shared_teams: ['FaZe'], open_parties: [] },
  { game_id: '570', game_name: 'Dota 2', players: 41, shared_regions: ['NA'], shared_teams: [], open_parties: [] },
  { game_id: '252490', game_name: 'Rust', players: 17, shared_regions: [], shared_teams: ['FaZe'], open_parties: [] },
  { game_id: 'Valorant', game_name: 'Valorant', players: 0, shared_regions: [], shared_teams: [], open_parties: [] },
  { game_id: 'Apex Legends', game_name: 'Apex Legends', players: 0, shared_regions: [], shared_teams: [], open_parties: [] },
  { game_id: 'Rocket League', game_name: 'Rocket League', players: 0, shared_regions: [], shared_teams: [], open_parties: [] }, // Epic: open to everyone
  { game_id: 'Fortnite', game_name: 'Fortnite', players: 96, shared_regions: ['NA'], shared_teams: ['FaZe'], open_parties: [] }, // Epic Games Store: no Steam library needed
];

export const seedParties = [
  { party_id: 'p-1', game_id: '730', game_name: 'Counter-Strike 2', region: 'NA', num_people: 3, people: ['a', 'b', 'c'] },
  { party_id: 'p-2', game_id: '570', game_name: 'Dota 2', region: 'NA', num_people: 1, people: ['d'] },
];

// Authors reuse the demo friend/suggestion ids so their names open a player page in demo mode, as they do against the API.
const who = (id, name, profile_color) => ({ id, name, profile_color });
const clutch = who('f1', 'clutch_kai', '#2563eb'), nova = who('f2', 'nova_strike', '#64748b'), ember = who('f3', 'ember_fox', '#f97316');
const vex = who('s1', 'vex_atlas', '#f5f5f5'), pixel = who('s2', 'pixel_ranger', '#06b6d4'), tess = who('s3', 'turbo_tess', '#111111');
const c = (id, author, text, h) => ({ id, author, text, at: hours(h) });
export const seedPosts = [
  { id: 'post-1', author: clutch, text: 'That eco round call on Map 1 was unreal.', likes: 24, liked: false, at: hours(-3), comments: [c('c-1', nova, 'Whoever made that call deserves a raise.', -2.8), c('c-2', ember, 'Rewatched it three times.', -2.5)] },
  { id: 'post-2', author: tess, text: 'Who is queueing CS2 tonight? NA, chill vibes.', likes: 9, liked: false, at: hours(-6), comments: [c('c-3', vex, 'Count me in.', -5.5)] },
  { id: 'post-3', author: vex, text: 'Shorts tab is dangerous. Told myself five minutes, watched twenty.', likes: 17, liked: false, at: hours(-9), comments: [c('c-4', pixel, 'Same here.', -8.6), c('c-5', clutch, 'This is the way.', -8)] },
  { id: 'post-4', author: ember, text: 'Looking for a fifth for Apex. Must tolerate bad jokes and worse aim.', likes: 6, liked: false, at: hours(-14), comments: [] },
  { id: 'post-5', author: pixel, text: 'Hot take: the old ILLCAMS compilations still hold up. Peak YouTube.', likes: 31, liked: false, at: hours(-20), comments: [c('c-6', tess, 'Bold take, but I respect it.', -19), c('c-7', nova, 'You are not wrong.', -18)] },
  { id: 'post-6', author: nova, text: 'Finally got my party into one voice channel without anyone muted. Small wins.', likes: 12, liked: false, at: hours(-30), comments: [c('c-8', ember, 'Run it back tomorrow?', -29)] },
];

export const seedPerks = [
  { id: 'merch-10', category: 'Merch discounts', title: '10% off merch', body: 'A one-time code for 10% off any merch order.', cost: 300, kind: 'merch_percent', percent: 10 },
  { id: 'merch-20', category: 'Merch discounts', title: '20% off any drop', body: 'A one-time code for 20% off any merch order.', cost: 700, kind: 'merch_percent', percent: 20 },
  { id: 'merch-15-off', category: 'Merch discounts', title: '$15 off a $60+ order', body: 'A one-time code for $15 off merch orders of $60 or more.', cost: 450, kind: 'merch_amount', amount_cents: 1500, min_spend_cents: 6000 },
  { id: 'merch-30-off', category: 'Merch discounts', title: '$30 off a $120+ order', body: 'A one-time code for $30 off merch orders of $120 or more.', cost: 900, kind: 'merch_amount', amount_cents: 3000, min_spend_cents: 12000 },
  { id: 'early-access', category: 'Digital', title: 'Early access to the next drop', body: 'Your code gets you in before the next merch drop opens to everyone.', cost: 500, kind: 'digital' },
  { id: 'wallpaper', category: 'Digital', title: 'Desktop wallpaper pack', body: 'Four exclusive wallpapers.', cost: 300, kind: 'digital' },
  { id: 'discord-role', category: 'Digital', title: 'Discord supporter role', body: 'A supporter role and colour in the community Discord.', cost: 600, kind: 'digital' },
  { id: 'badge', category: 'Digital', title: 'Profile badge', body: 'Show a Vault badge next to your name.', cost: 800, kind: 'digital' },
  { id: 'meet-streamer', category: 'Meet and greet', title: 'Meet your favorite FaZe streamer', body: 'Redeem for a claim code to meet your favorite FaZe streamer.', cost: 2000000, kind: 'digital' },
  { id: 'poster-raffle', category: 'Raffles', title: 'Signed poster raffle entry', body: 'One entry per redemption.', cost: 2500, kind: 'raffle' },
  { id: 'shoutout-raffle', category: 'Raffles', title: 'Creator shoutout raffle entry', body: 'One entry per redemption into the creator shoutout draw.', cost: 3500, kind: 'raffle' },
  { id: 'jersey-raffle', category: 'Raffles', title: 'Signed jersey raffle entry', body: 'One entry per redemption.', cost: 5000, kind: 'raffle' },
];

export const seedUpdates = [
  { round: 14, text: 'FaZe wins the round on a 3k clutch.' },
  { round: 13, text: 'Team Nova takes the B site.' },
  { round: 12, text: 'FaZe force-buys and wins.' },
];

export const seedFriends = [
  { id: 'f1', name: 'clutch_kai', profile_color: '#2563eb', online: true },
  { id: 'f2', name: 'nova_strike', profile_color: '#64748b', online: true },
  { id: 'f3', name: 'ember_fox', profile_color: '#f97316', online: false },
];

export const seedSimilar = [
  { user_id: 's1', user_name: 'vex_atlas', profile_color: '#f5f5f5', online: true, shared_games: ['Rocket League', 'Fortnite', 'Apex Legends'], shared_teams: ['FaZe CS2'], score: 9 },
  { user_id: 's2', user_name: 'pixel_ranger', profile_color: '#06b6d4', online: false, shared_games: ['Rocket League', 'Fortnite'], shared_teams: ['FaZe CS2'], score: 7 },
  { user_id: 's3', user_name: 'turbo_tess', profile_color: '#111111', online: true, shared_games: ['Apex Legends'], shared_teams: [], score: 2 },
];
