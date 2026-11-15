import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getFeed, getRecent, recordView, toggleLike } from '../services/shorts.js';

const router = Router();
router.use(requireAuth);

const shortId = z.string().regex(/^s\d{2,3}$/, 'Invalid short id');

// Ranked by the viewer's games/players plus what their friends play and like. Includes reward progress.
router.get('/feed', async (req, res) => res.json(await getFeed(req.user)));

router.get('/recent', async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(30).default(12) }).parse(req.query);
  res.json(await getRecent(req.user, limit));
});

// Call once the viewer has actually watched the short (the web app waits ~3s on the card).
router.post('/:id/view', async (req, res) => res.json(await recordView(req.user, shortId.parse(req.params.id))));

router.post('/:id/like', async (req, res) => res.json(await toggleLike(req.user, shortId.parse(req.params.id))));

export default router;
