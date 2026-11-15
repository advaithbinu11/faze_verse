import { MongoClient } from 'mongodb';
import { config } from './config.js';
import { ensureSchema } from './schemas.js';

let client;
let db;

export async function connect() {
  client = new MongoClient(config.mongo.uri, {
    maxPoolSize: config.mongo.maxPoolSize,
    minPoolSize: config.mongo.minPoolSize,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
    retryReads: true,
    writeConcern: { w: 'majority' },
  });

  client.on('serverHeartbeatFailed', (e) => console.error('[mongo] heartbeat failed:', e.failure?.message));
  client.on('topologyDescriptionChanged', (e) => {
    if (e.previousDescription.type !== e.newDescription.type) {
      console.log(`[mongo] topology ${e.previousDescription.type} -> ${e.newDescription.type}`);
    }
  });

  try {
    await client.connect();
    db = client.db(config.mongo.dbName);
    await db.command({ ping: 1 });
    await ensureSchema(db);
  } catch (err) {
    await client.close().catch(() => {});
    client = undefined;
    throw new Error(`MongoDB Atlas connection/setup failed: ${err.message}`, { cause: err });
  }
  console.log(`[mongo] connected to "${config.mongo.dbName}"`);
}

export const col = (name) => {
  if (!db) throw new Error('Database not connected');
  return db.collection(name);
};

export const ping = () => db.command({ ping: 1 });

export async function close() {
  await client?.close();
}

// Runs fn(session) in a snapshot/majority transaction. The driver retries fn on transient
// errors, so fn must have no side effects other than writes made with `session`.
export async function withTxn(fn) {
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' },
    );
    return result;
  } finally {
    await session.endSession();
  }
}
