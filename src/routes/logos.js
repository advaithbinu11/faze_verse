import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { buyLogo, listLogos, setActiveLogo } from '../services/logos.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => res.json(await listLogos(req.user)));
router.post('/purchase', async (req, res) => res.status(201).json(await buyLogo(req.user)));

const activeBody = z.object({ logo_id: z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid logo id').nullable() }).strict();
router.put('/active', async (req, res) => {
  const { logo_id } = activeBody.parse(req.body);
  await setActiveLogo(req.user, logo_id ? new ObjectId(logo_id) : null);
  res.json({ active_id: logo_id ? new ObjectId(logo_id) : null });
});

export default router;
