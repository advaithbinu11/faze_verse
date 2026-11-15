import { createTwitchApp } from './app.js';
import { config } from './config.js';
import * as db from './db.js';

await db.connect();

const server = createTwitchApp().listen(config.twitch.port, () => console.log(`[twitch] listening on :${config.twitch.port}`));

async function shutdown(signal) {
  console.log(`[twitch] ${signal} received, shutting down`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[twitch] unhandled rejection:', err));
