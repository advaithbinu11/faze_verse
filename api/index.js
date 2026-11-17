import { createApp } from '../src/app.js';
import * as db from '../src/db.js';

// Vercel reuses warm function instances, so share the connection promise and
// avoid starting the long-running worker process used by src/server.js.
const app = createApp();
let connection;

export default async function handler(req, res) {
  // CORS preflight must not depend on the database being available.
  if (req.method === 'OPTIONS') return app(req, res);
  connection ??= db.connect();
  try {
    await connection;
  } catch (error) {
    connection = undefined;
    console.error('[api] database unavailable:', error);
    return res.status(503).json({ error: 'Database unavailable' });
  }
  return app(req, res);
}
