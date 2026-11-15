import { createApp } from './app.js';
import { config } from './config.js';
import * as db from './db.js';
import { startWorkers } from './workers/index.js';

await db.connect();

const server = createApp().listen(config.port, () => console.log(`[api] listening on :${config.port}`));
const stopWorkers = config.workersEnabled ? startWorkers() : () => {};

async function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  stopWorkers();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[api] unhandled rejection:', err));
