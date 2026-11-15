import { col, withTxn } from '../db.js';
import { applyPoints } from './ledger.js';

const STALE_PROCESSING_MS = 5 * 60_000;

// Parimutuel payout: winners split the whole pool pro rata to their stake.
// BigInt avoids precision loss (stake * pool can exceed 2^53). Floor leaves dust in the pool.
export function computePayout(stake, winnerPool, totalPool) {
  return Number((BigInt(stake) * BigInt(totalPool)) / BigInt(winnerPool));
}

export function decideSettlement(event) {
  const winnerPool = event.winner ? event[`${event.winner}_points`] : 0;
  const refundAll = event.status === 'cancelled' || winnerPool === 0;
  return {
    refundAll,
    winnerPool,
    multiplier: refundAll ? 1 : event.total_points_invested / winnerPool,
  };
}

async function settlePrediction(prediction, event, settlement) {
  const isWinner = !settlement.refundAll && prediction.team === event.winner;
  const payout = settlement.refundAll
    ? prediction.points
    : isWinner
      ? computePayout(prediction.points, settlement.winnerPool, event.total_points_invested)
      : 0;
  const status = settlement.refundAll ? 'refunded' : isWinner ? 'won' : 'lost';

  await withTxn(async (session) => {
    // The status guard makes this idempotent: a crashed/rerun worker skips settled rows.
    const claimed = await col('predictions').findOneAndUpdate(
      { _id: prediction._id, status: 'pending' },
      { $set: { status, payout, settled_at: new Date() } },
      { session },
    );
    if (!claimed || payout === 0) return;
    await applyPoints(session, {
      userId: prediction.user_id,
      delta: payout,
      sourceType: settlement.refundAll ? 'refund' : 'payout',
      eventId: event.event_id,
      predictionId: prediction._id,
    });
  });
}

async function settleEvent(event) {
  const settlement = decideSettlement(event);
  const cursor = col('predictions').find({ event_id: event.event_id, status: 'pending' });
  for await (const prediction of cursor) {
    await settlePrediction(prediction, event, settlement);
  }
  await col('events').updateOne(
    { _id: event._id },
    { $set: { payout_status: 'done', payout_multiplier: settlement.multiplier, payout_completed_at: new Date() } },
  );
}

// Claims one completed/cancelled event awaiting payout and settles it. Returns false if none.
export async function processNextPayout() {
  await col('events').updateMany(
    { payout_status: 'processing', payout_started_at: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
    { $set: { payout_status: 'pending' } },
  );

  const event = await col('events').findOneAndUpdate(
    { payout_status: 'pending' },
    { $set: { payout_status: 'processing', payout_started_at: new Date() } },
    { sort: { closed_at: 1 }, returnDocument: 'after' },
  );
  if (!event) return false;

  try {
    await settleEvent(event);
  } catch (err) {
    await col('events').updateOne({ _id: event._id, payout_status: 'processing' }, { $set: { payout_status: 'pending' } });
    throw err;
  }
  console.log(`[payout] settled event ${event.event_id}`);
  return true;
}
