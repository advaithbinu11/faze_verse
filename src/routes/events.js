import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { applyPoints } from '../services/ledger.js';

const router = Router();

const withOdds = (e) => ({
  ...e,
  odds: {
    team_a: e.team_a_points ? e.total_points_invested / e.team_a_points : null,
    team_b: e.team_b_points ? e.total_points_invested / e.team_b_points : null,
  },
});

router.get('/', async (req, res) => {
  const q = z
    .object({
      status: z.enum(['upcoming', 'live', 'completed', 'cancelled']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      skip: z.coerce.number().int().min(0).default(0),
    })
    .parse(req.query);
  const events = await col('events')
    .find(q.status ? { status: q.status } : {})
    .sort({ start_time: q.status === 'completed' ? -1 : 1 })
    .skip(q.skip)
    .limit(q.limit)
    .toArray();
  res.json(events.map(withOdds));
});

router.get('/:eventId', async (req, res) => {
  const event = await col('events').findOne({ event_id: req.params.eventId });
  if (!event) throw new HttpError(404, 'Event not found');
  res.json(withOdds(event));
});

// ---- Predictions (authenticated) ----------------------------------------------------------

const predictionSchema = z.object({
  team: z.enum(['team_a', 'team_b']),
  points: z.number().int().min(1).max(config.points.maxPrediction),
});

router.post('/:eventId/predictions', requireAuth, async (req, res) => {
  const { team, points } = predictionSchema.parse(req.body);
  const { eventId } = req.params;
  const userId = req.user._id;

  try {
    const prediction = await withTxn(async (session) => {
      // The debit below is a guarded $inc, so it fails atomically if the balance is too low.
      // Pool update is conditional on the event still being open, so a prediction can never
      // slip in after kickoff or after the event is closed.
      const event = await col('events').findOneAndUpdate(
        { event_id: eventId, status: 'upcoming', start_time: { $gt: new Date() } },
        { $inc: { total_points_invested: points, [`${team}_points`]: points } },
        { session },
      );
      if (!event) throw new HttpError(409, 'Event is not open for predictions');

      const doc = { user_id: userId, event_id: eventId, team, points, status: 'pending', created_at: new Date() };
      const { insertedId } = await col('predictions').insertOne(doc, { session });
      await applyPoints(session, { userId, delta: -points, sourceType: 'prediction', eventId, predictionId: insertedId });
      return { ...doc, _id: insertedId };
    });
    res.status(201).json(prediction);
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'You already predicted this event');
    throw err;
  }
});

router.get('/:eventId/predictions/me', requireAuth, async (req, res) => {
  const p = await col('predictions').findOne({ event_id: req.params.eventId, user_id: req.user._id });
  if (!p) throw new HttpError(404, 'No prediction');
  res.json(p);
});

// ---- Administration -----------------------------------------------------------------------

const eventSchema = z.object({
  event_id: z.string().regex(/^[\w-]{3,64}$/).optional(),
  title: z.string().trim().min(1).max(120),
  team_a: z.string().trim().min(1).max(60),
  team_b: z.string().trim().min(1).max(60),
  game_name: z.string().trim().min(1).max(60),
  start_time: z.coerce.date(),
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const body = eventSchema.parse(req.body);
  const doc = {
    ...body,
    event_id: body.event_id ?? randomUUID(),
    status: 'upcoming',
    total_points_invested: 0,
    team_a_points: 0,
    team_b_points: 0,
    winner: null,
    payout_status: 'none',
    created_at: new Date(),
  };
  try {
    await col('events').insertOne(doc);
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'event_id already exists');
    throw err;
  }
  res.status(201).json(doc);
});

// Pools, status and winner are never editable here; they change only via predictions/close.
router.patch('/:eventId', requireAuth, requireAdmin, async (req, res) => {
  const update = eventSchema.partial().omit({ event_id: true }).strict().parse(req.body);
  if (!Object.keys(update).length) throw new HttpError(400, 'No fields to update');
  const updated = await col('events').findOneAndUpdate(
    { event_id: req.params.eventId, status: 'upcoming' },
    { $set: update, $unset: { reminder_sent_at: '' } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Event not found or no longer editable');
  res.json(updated);
});

// upcoming -> live closes predictions and triggers the match-start alert.
router.post('/:eventId/start', requireAuth, requireAdmin, async (req, res) => {
  const updated = await col('events').findOneAndUpdate(
    { event_id: req.params.eventId, status: 'upcoming' },
    { $set: { status: 'live', started_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Event not found or not upcoming');
  res.json(updated);
});

// Closing queues payout; the background worker settles it (see services/payout.js).
router.post('/:eventId/close', requireAuth, requireAdmin, async (req, res) => {
  const { winner } = z.object({ winner: z.enum(['team_a', 'team_b']) }).parse(req.body);
  const updated = await col('events').findOneAndUpdate(
    { event_id: req.params.eventId, status: { $in: ['upcoming', 'live'] } },
    { $set: { status: 'completed', winner, payout_status: 'pending', closed_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Event not found or already closed');
  res.json(updated);
});

// Cancelling refunds every stake.
router.post('/:eventId/cancel', requireAuth, requireAdmin, async (req, res) => {
  const updated = await col('events').findOneAndUpdate(
    { event_id: req.params.eventId, status: { $in: ['upcoming', 'live'] } },
    { $set: { status: 'cancelled', winner: null, payout_status: 'pending', closed_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new HttpError(409, 'Event not found or already closed');
  res.json(updated);
});

export default router;
