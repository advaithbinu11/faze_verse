import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';
import { col } from '../db.js';
import { HttpError } from '../errors.js';

export const signToken = (user) =>
  jwt.sign({ role: user.role ?? 'user' }, config.jwt.secret, {
    subject: String(user._id),
    expiresIn: config.jwt.ttl,
  });

export async function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Missing bearer token');
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwt.secret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  // Load the user so role changes and deletions take effect immediately.
  const user = await col('users').findOne({ _id: new ObjectId(payload.sub) });
  if (!user) throw new HttpError(401, 'User no longer exists');
  req.user = user;
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Admin access required');
  next();
}
