// Gives every user that has no password an email and a random password, so email sign-in works for them.
// Idempotent: users that already have a password_hash are never touched.
// Plaintext passwords are written once to seed-credentials.local.txt (gitignored, mode 600) and never logged.
import { randomInt } from 'node:crypto';
import { chmod, writeFile } from 'node:fs/promises';
import * as db from '../db.js';
import { hashPassword } from '../services/password.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no look-alike characters
const password = (len = 16) => Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'user';

const OUT = new URL('../../seed-credentials.local.txt', import.meta.url);

await db.connect();
try {
  const users = db.col('users');
  const taken = new Set((await users.find({ email: { $exists: true } }, { projection: { email: 1 } }).toArray()).map((u) => u.email));
  const todo = await users.find({ password_hash: { $exists: false } }, { projection: { user_name: 1, email: 1 } }).toArray();

  const lines = [];
  for (const u of todo) {
    let email = u.email;
    if (!email) {
      email = `${slug(u.user_name)}@fazevault.test`; // .test is reserved, so it can never be a real mailbox
      for (let i = 2; taken.has(email); i++) email = `${slug(u.user_name)}${i}@fazevault.test`;
      taken.add(email);
    }
    const plain = password();
    await users.updateOne({ _id: u._id, password_hash: { $exists: false } }, { $set: { email, password_hash: await hashPassword(plain) } });
    lines.push(`${u.user_name}\t${email}\t${plain}`);
  }

  if (lines.length) {
    await writeFile(OUT, `user_name\temail\tpassword\n${lines.join('\n')}\n`, { mode: 0o600 });
    await chmod(OUT, 0o600);
  }
  console.log(`[credentials] set for ${lines.length} user(s); ${todo.length ? 'saved to seed-credentials.local.txt' : 'nothing to do'}`);
} finally {
  await db.close();
}
