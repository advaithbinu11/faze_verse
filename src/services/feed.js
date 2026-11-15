import { ObjectId } from 'mongodb';
import { col, withTxn } from '../db.js';
import { HttpError } from '../errors.js';
import { applyPoints } from './ledger.js';

export const POST_BONUS = 3;
export const POST_BONUS_LIMIT = 3; // only a player's first few posts pay, so posting cannot be farmed
const PAGE = 50;

const author = (u) => ({ id: u?._id ?? null, name: u?.user_name ?? 'Deleted user', profile_color: u?.profile_color ?? null });

// Newest posts first, each with its author, like count, whether the viewer liked it, and its comments (oldest first).
// Authors are rows of the `users` collection, so the web app links each one to /u/:id.
export async function listPosts(viewer, limit = PAGE) {
  const posts = await col('posts').find({}).sort({ created_at: -1 }).limit(limit).toArray();
  const ids = posts.map((p) => p._id);
  const [likes, mine, comments] = await Promise.all([
    col('post_likes').aggregate([{ $match: { post_id: { $in: ids } } }, { $group: { _id: '$post_id', n: { $sum: 1 } } }]).toArray(),
    col('post_likes').find({ post_id: { $in: ids }, user_id: viewer._id }).project({ post_id: 1, _id: 0 }).toArray(),
    col('post_comments').find({ post_id: { $in: ids } }).sort({ created_at: 1 }).toArray(),
  ]);
  const userIds = [...new Set([...posts, ...comments].map((x) => String(x.user_id)))].map((id) => new ObjectId(id));
  const users = await col('users').find({ _id: { $in: userIds } }, { projection: { user_name: 1, profile_color: 1 } }).toArray();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const likeCount = new Map(likes.map((l) => [String(l._id), l.n]));
  const liked = new Set(mine.map((l) => String(l.post_id)));
  const commentsBy = new Map();
  for (const c of comments) commentsBy.set(String(c.post_id), [...(commentsBy.get(String(c.post_id)) ?? []), toComment(c, byId)]);

  return posts.map((p) => ({
    id: p._id,
    author: author(byId.get(String(p.user_id))),
    text: p.text,
    at: p.created_at,
    likes: likeCount.get(String(p._id)) ?? 0,
    liked: liked.has(String(p._id)),
    comments: commentsBy.get(String(p._id)) ?? [],
  }));
}

const toComment = (c, byId) => ({ id: c._id, author: author(byId.get(String(c.user_id))), text: c.text, at: c.created_at });

// Creates a post; the first POST_BONUS_LIMIT posts of a player also pay POST_BONUS points, in the same transaction.
export async function createPost(user, text) {
  return withTxn(async (session) => {
    const doc = { user_id: user._id, text, created_at: new Date() };
    const { insertedId } = await col('posts').insertOne(doc, { session });
    const paid = await col('point_transactions').countDocuments({ user_id: user._id, source_type: 'post_bonus' }, { session });
    let bonus = 0;
    if (paid < POST_BONUS_LIMIT) {
      await applyPoints(session, { userId: user._id, delta: POST_BONUS, sourceType: 'post_bonus' });
      bonus = POST_BONUS;
    }
    return { post: { id: insertedId, author: author(user), text, at: doc.created_at, likes: 0, liked: false, comments: [] }, bonus };
  });
}

async function mustFindPost(id) {
  const post = await col('posts').findOne({ _id: id }, { projection: { _id: 1 } });
  if (!post) throw new HttpError(404, 'Post not found');
}

// The unique (post_id, user_id) index makes liking idempotent; a second call removes the like.
export async function toggleLike(user, postId) {
  await mustFindPost(postId);
  const removed = await col('post_likes').deleteOne({ post_id: postId, user_id: user._id });
  if (!removed.deletedCount) {
    try { await col('post_likes').insertOne({ post_id: postId, user_id: user._id, created_at: new Date() }); }
    catch (e) { if (e.code !== 11000) throw e; }
  }
  const [likes, liked] = await Promise.all([col('post_likes').countDocuments({ post_id: postId }), col('post_likes').findOne({ post_id: postId, user_id: user._id })]);
  return { likes, liked: Boolean(liked) };
}

export async function addComment(user, postId, text) {
  await mustFindPost(postId);
  const doc = { post_id: postId, user_id: user._id, text, created_at: new Date() };
  const { insertedId } = await col('post_comments').insertOne(doc);
  return { id: insertedId, author: author(user), text, at: doc.created_at };
}
