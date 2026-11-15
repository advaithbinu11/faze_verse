// npm run db:setup: applies validators and indexes without starting the API.
import * as db from '../db.js';

await db.connect();
await db.close();
console.log('Schema validation and indexes are up to date.');
