// Idempotent. Registers every short in the catalogue in `watch_videos` and brings `users` in line with `short_views`:
//   - watch_videos: one row per short, keyed by its YouTube id (catalogue id for Instagram/TikTok/X posts).
//     Rows are inactive, so /youtube/sessions never pays points for them; shorts pay through the 5-shorts bonus instead.
//   - users: watched_history gets each viewed short's key and shorts_viewed is set to the number of unique views.
// Run: npm run db:seed-shorts
import * as db from '../db.js';
import { col } from '../db.js';
import { CATALOG, POINTS_PER_BATCH, BATCH_SIZE, durationSeconds, historyKey } from '../services/shortsRank.js';

await db.connect();

const POINTS_PER_SHORT = POINTS_PER_BATCH / BATCH_SIZE; // informational: what one short is worth on average
const videos = await col('watch_videos').bulkWrite(
  CATALOG.map((s) => ({
    updateOne: {
      filter: { video_id: historyKey(s) },
      update: {
        $set: { title: s.title, duration_seconds: Math.max(1, durationSeconds(s.duration)), points: POINTS_PER_SHORT, active: false, kind: 'short', game: s.game, url: s.url },
      },
      upsert: true,
    },
  })),
);
console.log(`watch_videos: ${videos.upsertedCount} added, ${videos.modifiedCount} updated, ${CATALOG.length - videos.upsertedCount - videos.modifiedCount} unchanged.`);

const keyOf = new Map(CATALOG.map((s) => [s.id, historyKey(s)]));
const views = await col('short_views').aggregate([{ $group: { _id: '$user_id', shorts: { $addToSet: '$short_id' } } }]).toArray();
let users = 0;
for (const v of views) {
  const keys = v.shorts.map((id) => keyOf.get(id)).filter(Boolean);
  const r = await col('users').updateOne({ _id: v._id }, { $addToSet: { watched_history: { $each: keys } }, $set: { shorts_viewed: v.shorts.length } });
  users += r.modifiedCount;
}
console.log(`users: ${users} updated from ${views.length} viewer(s).`);
await db.close();
