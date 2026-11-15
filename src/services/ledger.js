import { col } from '../db.js';
import { HttpError } from '../errors.js';

const INT32_MAX = 2 ** 31 - 1;

// Moves points for one user and appends the ledger row. MUST be called inside withTxn so the
// balance change, ledger entry and any caller writes commit or abort together. Debits are
// guarded by `faze_points >= amount` in the same atomic update, so concurrent requests can
// never overdraw (the schema's `minimum: 0` is a second line of defence).
export async function applyPoints(session, { userId, delta, sourceType, eventId, videoId, predictionId }) {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > INT32_MAX) {
    throw new Error(`Invalid point delta: ${delta}`);
  }

  const filter = delta < 0 ? { _id: userId, faze_points: { $gte: -delta } } : { _id: userId };
  const updated = await col('users').findOneAndUpdate(
    filter,
    { $inc: { faze_points: delta } },
    { session, returnDocument: 'after', projection: { faze_points: 1 } },
  );
  if (!updated) throw new HttpError(delta < 0 ? 402 : 404, delta < 0 ? 'Insufficient points' : 'User not found');

  await col('point_transactions').insertOne(
    {
      user_id: userId,
      points: delta,
      balance_after: updated.faze_points,
      source_type: sourceType,
      timestamp: new Date(),
      ...(eventId && { event_id: eventId }),
      ...(videoId && { video_id: videoId }),
      ...(predictionId && { prediction_id: predictionId }),
    },
    { session },
  );
  return updated.faze_points;
}
