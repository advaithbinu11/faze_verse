import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { addComment, createPost, listPosts, toggleLike } from '../services/feed.js';

const router = Router();
router.use(requireAuth);

const postId = (raw) => {
  if (!ObjectId.isValid(raw) || String(new ObjectId(raw)) !== String(raw)) throw new HttpError(400, 'Invalid post id');
  return new ObjectId(raw);
};
const postBody = z.object({ text: z.string().trim().min(1).max(240) }).strict();
const commentBody = z.object({ text: z.string().trim().min(1).max(200) }).strict();

router.get('/', async (req, res) => res.json(await listPosts(req.user)));
router.post('/', async (req, res) => res.status(201).json(await createPost(req.user, postBody.parse(req.body).text)));
router.post('/:id/like', async (req, res) => res.json(await toggleLike(req.user, postId(req.params.id))));
router.post('/:id/comments', async (req, res) => res.status(201).json(await addComment(req.user, postId(req.params.id), commentBody.parse(req.body).text)));

export default router;
