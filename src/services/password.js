import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64;
const OPTS = { N, r: R, p: P, maxmem: 128 * N * R * 2 };

// Stored as scrypt$N$r$p$salt$hash (base64), so parameters can be raised later without breaking old hashes.
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, OPTS);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return timingSafeEqual(actual, expected);
}

// Compared against when the email is unknown, so login time doesn't reveal which emails exist.
export const DUMMY_HASH = await hashPassword('not-a-real-password');
