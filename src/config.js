import 'dotenv/config';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable ${key}`);
  return value;
};

const int = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`${key} must be an integer`);
  return n;
};

const list = (key) =>
  (process.env[key] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Optional hardcoded connection string (gitignored). Absent on a fresh clone, where the env vars apply.
const hardcodedUri = await import('./mongo-uri.local.js').then((m) => m.default, () => undefined);
const mongoUri = hardcodedUri || process.env.MONGODB_URI || required('MONGO_DB_URL');

const jwtSecret = required('JWT_SECRET');
const isProd = process.env.NODE_ENV === 'production';
const dev = (key, fallback) => process.env[key] || (isProd ? required(key) : fallback);
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

function loopbackTwin(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'localhost') return undefined;
    u.hostname = '127.0.0.1';
    return u.origin;
  } catch {
    return undefined;
  }
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: int('PORT', 3000),
  mongo: {
    uri: mongoUri,
    // Explicit MONGODB_DB wins, then a database named in the URL, then the literal platform name (it ends in a semicolon).
    dbName: process.env.MONGODB_DB || new URL(mongoUri).pathname.slice(1) || 'faze_platform;',
    maxPoolSize: int('MONGODB_MAX_POOL', 50),
    minPoolSize: int('MONGODB_MIN_POOL', 5),
  },
  jwt: { secret: jwtSecret, ttl: process.env.JWT_TTL ?? '7d' },
  apiBaseUrl: dev('API_BASE_URL', 'http://localhost:3000').replace(/\/$/, ''),
  frontendUrl: dev('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  // Extra browser origins allowed by CORS. In development the 127.0.0.1 twin of FRONTEND_URL is included,
  // because a page opened on 127.0.0.1 is a different origin from localhost and its requests are blocked.
  corsOrigins: [...list('CORS_ORIGINS'), ...(isProd ? [] : [loopbackTwin(process.env.FRONTEND_URL || 'http://localhost:5173')])].filter(Boolean),
  adminSteamIds: list('ADMIN_STEAM_IDS'),
  steamApiKey: process.env.STEAM_API_KEY ?? '',
  points: {
    signupBonus: int('SIGNUP_BONUS_POINTS', 1000),
    maxPrediction: int('MAX_PREDICTION_POINTS', 100000),
  },
  // Twitch app credentials (dev.twitch.tv/console) let the API look up a channel's latest past broadcast. Optional.
  twitch: {
    port: int('TWITCH_PORT', 3500),
    clientId: process.env.TWITCH_CLIENT_ID ?? '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
    // Live-stream watch points: 1 point per 30s of verified playback, up to this many per UTC day.
    dailyPointCap: int('TWITCH_DAILY_POINT_CAP', 100),
  },
  watchMinRatio: Number(process.env.WATCH_MIN_RATIO ?? 0.9),
  partyMaxSize: int('PARTY_MAX_SIZE', 5),
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN ?? '',
    // OAuth2 app used to verify a player's Discord account (redirect URI: API_BASE_URL/auth/discord/callback).
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    announceChannelId: process.env.DISCORD_ANNOUNCE_CHANNEL_ID ?? '',
    pingRoleId: process.env.DISCORD_PING_ROLE_ID ?? '',
    reminderMinutes: int('EVENT_REMINDER_MINUTES', 30),
    // Faker service that owns party voice channels. Unset = parties are created without a Discord channel.
    partyServiceUrl: (process.env.DISCORD_PARTY_SERVICE_URL ?? '').replace(/\/$/, ''),
    partyServiceKey: process.env.DISCORD_PARTY_SERVICE_KEY ?? '',
  },
  workersEnabled: process.env.DISABLE_WORKERS !== '1',
};
