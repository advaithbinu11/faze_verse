import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { col } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { discordEnabled, sendMessage } from '../services/discord.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const videoSchema = z.object({
  video_id: z.string().regex(/^[\w-]{11}$/),
  title: z.string().trim().max(200).optional(),
  duration_seconds: z.number().int().min(1).max(86_400),
  points: z.number().int().min(1).max(100_000),
  active: z.boolean().default(true),
});

router.put('/videos', async (req, res) => {
  const video = videoSchema.parse(req.body);
  await col('watch_videos').updateOne({ video_id: video.video_id }, { $set: video }, { upsert: true });
  res.json(video);
});

router.get('/videos', async (_req, res) => res.json(await col('watch_videos').find().toArray()));

// Community engagement prompt, posted to the announce channel (or an explicit channel).
router.post('/discord/announce', async (req, res) => {
  const { content, channelId } = z
    .object({ content: z.string().trim().min(1).max(1900), channelId: z.string().regex(/^\d{15,25}$/).optional() })
    .parse(req.body);
  if (!discordEnabled()) throw new HttpError(503, 'Discord bot token is not configured');
  const target = channelId ?? config.discord.announceChannelId;
  if (!target) throw new HttpError(400, 'No channel configured');
  await sendMessage(target, { content });
  res.status(202).json({ sent: true });
});

export default router;
