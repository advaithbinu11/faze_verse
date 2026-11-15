// Idempotent. Reads Fazeclanhistory.pdf, splits it into chunks, embeds each with Voyage AI and stores them in
// `faze_history_chunks` (re-running replaces the set). Run: npm run db:ingest-history [path/to/file.pdf]
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import * as db from '../db.js';
import { col } from '../db.js';
import { config } from '../config.js';
import { chunkHistory, embed } from '../services/rag.js';

const file = resolve(process.argv[2] ?? 'Fazeclanhistory.pdf');
const { text, numpages } = await pdf(await readFile(file));
const chunks = chunkHistory(text, basename(file));
console.log(`${numpages} pages -> ${chunks.length} chunks (avg ${Math.round(chunks.reduce((n, c) => n + c.text.length, 0) / chunks.length)} chars)`);

const vectors = await embed(chunks.map((c) => c.text), 'document');
await db.connect();
const docs = chunks.map((c, i) => ({ ...c, embedding: vectors[i], embedding_model: config.rag.voyageModel }));
await col('faze_history_chunks').bulkWrite([
  { deleteMany: { filter: { chunk_id: { $nin: docs.map((d) => d.chunk_id) } } } },
  ...docs.map((d) => ({ replaceOne: { filter: { chunk_id: d.chunk_id }, replacement: d, upsert: true } })),
]);
console.log(`faze_history_chunks: ${docs.length} chunks stored (${vectors[0].length}-dim, ${config.rag.voyageModel}).`);
await db.close();
