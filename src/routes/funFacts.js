import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { getFunFact } from '../services/rag.js';

const router = Router();
router.use(requireAuth);

// Every generation costs an embedding and an LLM call, so it is capped per signed-in user.
router.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => String(req.user._id), validate: { keyGeneratorIpFallback: false } }));

// The user's current fun fact: reuses one generated in the last few minutes, otherwise makes a new one.
router.get('/', async (req, res) => res.json(await getFunFact(req.user)));

// "Another one": always a new fact.
router.post('/', async (req, res) => res.json(await getFunFact(req.user, { fresh: true })));

export default router;
