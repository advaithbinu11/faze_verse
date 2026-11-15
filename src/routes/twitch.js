import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { helixEnabled, latestBroadcast, recordBeat } from '../services/twitch.js';

const router = Router();

const login = z.string().toLowerCase().regex(/^[a-z0-9_]{3,25}$/, 'Invalid Twitch channel');

// Latest past broadcast of a channel, for replaying it while the channel is offline. Public: it is the same data twitch.tv shows.
router.get('/channels/:channel/latest-video', async (req, res) => {
  if (!helixEnabled()) throw new HttpError(503, 'Twitch replays are not configured');
  const video = await latestBroadcast(login.parse(req.params.channel));
  if (!video) throw new HttpError(404, 'No past broadcasts found');
  res.json(video);
});

// The Live page calls this about every 15s while a Twitch player is on screen.
router.post('/watch/beat', requireAuth, async (req, res) => {
  const { playing } = z.object({ playing: z.boolean() }).strict().parse(req.body);
  res.json(await recordBeat(req.user._id, { playing }));
});

export default router;
