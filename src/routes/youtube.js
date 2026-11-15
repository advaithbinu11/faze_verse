import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { recordState, startSession } from '../services/watch.js';

const router = Router();
router.use(requireAuth);

// Frontend flow: POST /sessions when the player loads, then POST /sessions/:id/events on every
// onStateChange (PLAYING/PAUSED/BUFFERING/ENDED) plus a PLAYING heartbeat every ~15s.
router.post('/sessions', async (req, res) => {
  const { videoId } = z.object({ videoId: z.string().regex(/^[\w-]{11}$/) }).parse(req.body);
  res.status(201).json(await startSession(req.user._id, videoId));
});

const stateSchema = z.object({
  state: z.enum(['PLAYING', 'PAUSED', 'BUFFERING', 'ENDED']),
  position: z.number().min(0).max(86_400), // player.getCurrentTime(), seconds
});

router.post('/sessions/:id/events', async (req, res) => {
  const id = z.string().refine(ObjectId.isValid, 'Invalid session id').parse(req.params.id);
  res.json(await recordState(req.user._id, id, stateSchema.parse(req.body)));
});

export default router;
