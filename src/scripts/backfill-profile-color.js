// One-off, idempotent: gives every user without a profile_color a random one from the palette.
// Run: node src/scripts/backfill-profile-color.js
import * as db from '../db.js';
import { col } from '../db.js';
import { randomColor } from '../services/colors.js';

await db.connect();
const missing = await col('users').find({ profile_color: { $exists: false } }, { projection: { _id: 1 } }).toArray();
if (missing.length) {
  await col('users').bulkWrite(
    missing.map((u) => ({ updateOne: { filter: { _id: u._id, profile_color: { $exists: false } }, update: { $set: { profile_color: randomColor() } } } })),
  );
}
console.log(`Backfilled profile_color on ${missing.length} user(s); ${await col('users').countDocuments({ profile_color: { $exists: false } })} still missing.`);
await db.close();
