import { ObjectId } from 'mongodb';
import { config } from '../config.js';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { applyPoints } from './ledger.js';

// Longest gap between two player events we will credit as continuous playback. The client
// is expected to send a PLAYING heartbeat at least every 30s.
const MAX_CREDIT_MS = 60_000;
const POSITION_SLACK_MS = 2_000;
const END_TOLERANCE_S = 5;

export async function startSession(userId, videoId) {
  const video = await col('watch_videos').findOne({ video_id: videoId, active: true });
  if (!video) throw new HttpError(404, 'Video is not eligible for points');
  if (await col('users').findOne({ _id: userId, watched_history: videoId }, { projection: { _id: 1 } })) {
    throw new HttpError(409, 'Points for this video were already claimed');
  }
  const now = new Date();
  const { insertedId } = await col('watch_sessions').insertOne({
    user_id: userId,
    video_id: videoId,
    state: 'CREATED',
    watched_ms: 0,
    last_position: 0,
    last_state_at: now,
    completed: false,
    created_at: now,
  });
  return { session_id: insertedId, duration_seconds: video.duration_seconds, points: video.points };
}

// Watch time is derived from SERVER time between state changes, bounded by how far the
// reported playback position actually advanced, so a client cannot claim time it didn't spend.
export async function recordState(userId, sessionId, { state, position }) {
  const session = await col('watch_sessions').findOne({ _id: new ObjectId(sessionId), user_id: userId });
  if (!session) throw new HttpError(404, 'Session not found');
  if (session.completed) throw new HttpError(409, 'Session already completed');

  const nowMs = Date.now();
  let watched = session.watched_ms;
  if (session.state === 'PLAYING') {
    const elapsed = nowMs - session.last_state_at.getTime();
    const advanced = Math.max(0, position - session.last_position) * 1000 + POSITION_SLACK_MS;
    watched += Math.max(0, Math.min(elapsed, advanced, MAX_CREDIT_MS));
  }
  watched = Math.floor(watched);

  // Optimistic concurrency: a concurrent/duplicate event for the same interval loses here.
  const { modifiedCount } = await col('watch_sessions').updateOne(
    { _id: session._id, last_state_at: session.last_state_at, completed: false },
    { $set: { state, watched_ms: watched, last_position: position, last_state_at: new Date(nowMs) } },
  );
  if (!modifiedCount) throw new HttpError(409, 'Conflicting player event, retry');

  const result = { state, watched_seconds: Math.floor(watched / 1000), awarded: 0 };
  if (state !== 'ENDED') return result;

  const video = await col('watch_videos').findOne({ video_id: session.video_id });
  const watchedEnough = watched >= video.duration_seconds * 1000 * config.watchMinRatio;
  const reachedEnd = position >= video.duration_seconds - END_TOLERANCE_S;
  if (!watchedEnough || !reachedEnd) return { ...result, reason: 'Video not watched long enough' };

  const awarded = await withTxn(async (session2) => {
    // Atomic once-per-video guard: only the first claim matches the filter.
    const claim = await col('users').updateOne(
      { _id: userId, watched_history: { $ne: video.video_id } },
      { $addToSet: { watched_history: video.video_id } },
      { session: session2 },
    );
    if (!claim.modifiedCount) return 0;
    await applyPoints(session2, { userId, delta: video.points, sourceType: 'watch_time', videoId: video.video_id });
    await col('watch_sessions').updateOne({ _id: session._id }, { $set: { completed: true } }, { session: session2 });
    return video.points;
  });
  return { ...result, awarded };
}
