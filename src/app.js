import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { ping } from './db.js';
import { HttpError } from './errors.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feed.js';
import funFactRoutes from './routes/funFacts.js';
import eventRoutes from './routes/events.js';
import logoRoutes from './routes/logos.js';
import merchRoutes from './routes/merch.js';
import partyRoutes from './routes/parties.js';
import perkRoutes from './routes/perks.js';
import shortsRoutes from './routes/shorts.js';
import twitchRoutes from './routes/twitch.js';
import userRoutes from './routes/users.js';
import youtubeRoutes from './routes/youtube.js';

// Shared setup: security headers, CORS for the web app, JSON bodies, a global rate limit and /health.
function baseApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  // CORS for the web app only (the token travels in an Authorization header, so no credentials mode is needed).
  const allowedOrigins = new Set([config.frontendUrl, ...config.corsOrigins]);
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowedOrigins.has(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: '20kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/health', async (_req, res) => {
    await ping();
    res.json({ ok: true });
  });
  return app;
}

function finish(app) {
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}

export function createApp() {
  const app = baseApp();
  app.use('/auth', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes);
  app.use('/users', userRoutes);
  app.use('/events', eventRoutes);
  app.use('/youtube', youtubeRoutes);
  app.use('/shorts', shortsRoutes);
  app.use('/fun-fact', funFactRoutes);
  app.use('/feed', feedRoutes);
  app.use('/logos', logoRoutes);
  app.use('/twitch', twitchRoutes);
  app.use('/parties', partyRoutes);
  app.use('/perks', perkRoutes);
  app.use('/merch', merchRoutes);
  app.use('/admin', adminRoutes);
  return finish(app);
}

// Standalone service for Twitch only (replays and watch points), so it can run on its own port.
export function createTwitchApp() {
  const app = baseApp();
  app.use('/twitch', twitchRoutes);
  return finish(app);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err instanceof ZodError) return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate record' });
    if (err.code === 121) return res.status(500).json({ error: 'Document failed schema validation' });
    console.error(err);
    res.status(500).json({ error: config.env === 'production' ? 'Internal server error' : err.message });
}
