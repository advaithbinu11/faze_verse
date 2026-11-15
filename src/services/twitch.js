import { config } from '../config.js';
import { col, withTxn } from '../db.js';
import { applyPoints } from './ledger.js';

// ---------- watch points for live streams ----------
// A stream has no end, so points accrue instead: 1 point per 30s of playback, up to a daily cap.
// Time is measured by the SERVER between heartbeats; the client only says whether the player is playing.
const BEAT_MIN_MS = 10_000; // faster beats are ignored, so spamming the endpoint earns nothing
const MAX_CREDIT_MS = 45_000; // longest gap credited as continuous playback (the client beats every ~15s)
export const MS_PER_INTERVAL = 30_000;
export const POINTS_PER_INTERVAL = 10; // 10 points for every full 30 seconds of verified playback

// Points owed so far today: whole intervals of credited playback, capped for the day, minus what was already paid.
export const pointsDue = (creditedMs, awarded, cap) => Math.max(0, Math.min(Math.floor(creditedMs / MS_PER_INTERVAL) * POINTS_PER_INTERVAL, cap) - awarded);

const today = () => new Date().toISOString().slice(0, 10);

export async function recordBeat(userId, { playing }) {
  const day = today();
  const cap = config.twitch.dailyPointCap;
  const now = new Date();
  const filter = { user_id: userId, day };
  await col('twitch_watch').updateOne(
    filter,
    { $setOnInsert: { credited_ms: 0, awarded: 0, last_beat: now, last_playing: Boolean(playing) } },
    { upsert: true },
  ).catch((err) => { if (err.code !== 11000) throw err; }); // a concurrent first beat already created today's row
  const doc = await col('twitch_watch').findOne(filter);

  const elapsed = now - doc.last_beat;
  if (elapsed < BEAT_MIN_MS && elapsed > 0) return { awarded: 0, today: doc.awarded, cap };

  const credited = doc.credited_ms + (doc.last_playing ? Math.min(elapsed, MAX_CREDIT_MS) : 0);
  // Optimistic concurrency: two tabs beating at once cannot both claim the same interval.
  const { modifiedCount } = await col('twitch_watch').updateOne(
    { _id: doc._id, last_beat: doc.last_beat },
    { $set: { credited_ms: credited, last_beat: now, last_playing: Boolean(playing) } },
  );
  if (!modifiedCount) return { awarded: 0, today: doc.awarded, cap };

  const due = pointsDue(credited, doc.awarded, cap);
  if (due <= 0) return { awarded: 0, today: doc.awarded, cap };

  const awarded = await withTxn(async (session) => {
    const claim = await col('twitch_watch').updateOne({ _id: doc._id, awarded: doc.awarded }, { $inc: { awarded: due } }, { session });
    if (!claim.modifiedCount) return 0;
    await applyPoints(session, { userId, delta: due, sourceType: 'watch_time' });
    return due;
  });
  return { awarded, today: doc.awarded + awarded, cap };
}

// ---------- latest past broadcast (Twitch Helix API) ----------
export const helixEnabled = () => Boolean(config.twitch.clientId && config.twitch.clientSecret);

let token = { value: '', expires: 0 };
async function appToken() {
  if (token.value && Date.now() < token.expires - 60_000) return token.value;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: config.twitch.clientId, client_secret: config.twitch.clientSecret, grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Twitch token request failed (${res.status})`);
  const { access_token, expires_in } = await res.json();
  token = { value: access_token, expires: Date.now() + expires_in * 1000 };
  return token.value;
}

async function helix(path) {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: { 'client-id': config.twitch.clientId, authorization: `Bearer ${await appToken()}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Twitch ${path} failed (${res.status})`);
  return (await res.json()).data;
}

// Cached for 10 minutes per channel so page loads never turn into Twitch API calls.
const cache = new Map();
const TTL_MS = 10 * 60_000;

export async function latestBroadcast(channel) {
  const hit = cache.get(channel);
  if (hit && Date.now() < hit.expires) return hit.value;
  const [user] = await helix(`/users?login=${encodeURIComponent(channel)}`);
  const [video] = user ? await helix(`/videos?user_id=${user.id}&type=archive&first=1`) : [];
  const value = video ? { id: video.id, title: video.title, created_at: video.created_at, duration: video.duration, url: video.url } : null;
  if (cache.size > 500) cache.clear();
  cache.set(channel, { value, expires: Date.now() + TTL_MS });
  return value;
}
