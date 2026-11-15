import { col } from '../db.js';
import { HttpError } from '../errors.js';
import { config } from '../config.js';

// Retrieval-augmented fun facts from the FaZe history PDF, following MongoDB's Voyage AI RAG tutorial:
// chunk -> embed with Voyage -> cosine-similarity retrieval -> answer with an LLM using only the retrieved text.
// Chunks and vectors are persisted in `faze_history_chunks` and searched in memory (the corpus is ~100 chunks).

const EMBED_BATCH = 64;
const MAX_CHUNK_CHARS = 1100;
const TOP_K = 8; // retrieved per query; a random few are shown to the model, so repeat visits differ
const CONTEXT_CHUNKS = 3;
const RECENT_FACTS = 6; // earlier facts are shown to the model so it does not repeat them
// A new visit within this window gets the same fact back (cheap, and the page does not flicker on reload).
export const FACT_REUSE_MS = 10 * 60_000;

// ---- chunking ----------------------------------------------------------------------------------

const ENTRY_START = /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(?:\d{1,2},\s+)?)?(?:19|20)\d{2}\s+·\s/;
const SECTION_START = /^\d{2}\s+(?:19|20)\d{2}(?:-\d{2})?\s+—\s/;
const YEAR = /\b((?:19|20)\d{2})\b/;

// The PDF is a timeline: one entry per "Mon YYYY · headline" line, followed by its body. Entries are kept whole and
// short neighbours are merged up to MAX_CHUNK_CHARS, so a chunk is a few related events with their dates.
export function chunkHistory(text, source = 'Fazeclanhistory.pdf') {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let section = '';
  for (const line of lines) {
    if (SECTION_START.test(line)) { section = line.replace(/^\d{2}\s+/, ''); continue; }
    if (ENTRY_START.test(line) || !entries.length) entries.push({ heading: line, section, body: [] });
    else entries.at(-1).body.push(line);
  }
  const rendered = entries.map((e) => ({ ...e, text: [e.heading, ...e.body].join(' ').replace(/\s+/g, ' ') }));

  const chunks = [];
  let cur = null;
  for (const e of rendered) {
    const piece = e.text.length > MAX_CHUNK_CHARS ? e.text.slice(0, MAX_CHUNK_CHARS) : e.text;
    if (cur && cur.text.length + piece.length + 1 <= MAX_CHUNK_CHARS && cur.section === e.section) cur.text += `\n${piece}`;
    else chunks.push((cur = { heading: e.heading, section: e.section, text: piece }));
  }
  return chunks
    .filter((c) => c.text.length > 60)
    .map((c, i) => ({
      chunk_id: `h${String(i).padStart(3, '0')}`,
      text: c.section ? `${c.section}\n${c.text}` : c.text,
      heading: c.heading.slice(0, 200),
      ...(YEAR.test(c.heading) && { year: Number(c.heading.match(YEAR)[1]) }),
      source,
    }));
}

// ---- embeddings --------------------------------------------------------------------------------

// Batches are capped by size (~4 chars per token) so one request stays under small per-minute token limits, and a 429
// is retried after the wait the API asks for (Voyage's no-billing tier allows 3 requests and 10K tokens per minute).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_BATCH_CHARS = 20_000;

async function embedBatch(input, inputType) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(config.rag.voyageUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.rag.voyageKey}` },
      body: JSON.stringify({ input, model: config.rag.voyageModel, input_type: inputType }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (res.status === 429 && attempt < 5) {
      const wait = (Number(res.headers.get('retry-after')) || 21) * 1000;
      console.log(`[rag] embedding rate limited, retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Embedding request failed (${res.status}): ${data.detail ?? data.message ?? 'unknown error'}`);
  }
}

export async function embed(texts, inputType) {
  if (!config.rag.voyageKey) throw new HttpError(503, 'Fun facts are not configured');
  const batches = [];
  for (const [i, t] of texts.entries()) {
    const last = batches.at(-1);
    if (last && last.chars + t.length <= MAX_BATCH_CHARS && last.items.length < EMBED_BATCH) { last.items.push(i); last.chars += t.length; }
    else batches.push({ items: [i], chars: t.length });
  }
  const out = new Array(texts.length);
  for (const [n, batch] of batches.entries()) {
    if (n) await sleep(21_000); // stay under 3 requests per minute
    const vectors = await embedBatch(batch.items.map((i) => texts[i]), inputType);
    batch.items.forEach((idx, j) => { out[idx] = vectors[j]; });
  }
  return out;
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---- retrieval ---------------------------------------------------------------------------------

let corpus; // { model, chunks } loaded once per process, refreshed when the embedding model changes
async function loadCorpus() {
  if (corpus?.model === config.rag.voyageModel) return corpus.chunks;
  const chunks = await col('faze_history_chunks').find({ embedding_model: config.rag.voyageModel }).project({ _id: 0 }).toArray();
  if (!chunks.length) throw new HttpError(503, 'The FaZe history has not been ingested yet (npm run db:ingest-history)');
  corpus = { model: config.rag.voyageModel, chunks };
  return chunks;
}
export const resetCorpusCache = () => { corpus = undefined; };

// Voyage vectors are unit length, so the dot product is the cosine similarity.
export async function retrieve(query, k = TOP_K) {
  const [chunks, [q]] = await Promise.all([loadCorpus(), embed([query], 'query')]);
  return chunks.map((c) => ({ ...c, score: dot(q, c.embedding) })).sort((a, b) => b.score - a.score).slice(0, k);
}

// ---- personalisation ---------------------------------------------------------------------------

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

async function interestsOf(user) {
  const games = await col('user_games').find({ user_id: user._id }).project({ game_name: 1, _id: 0 }).limit(30).toArray();
  return [
    ...(user.favorite_players ?? []).map((v) => ({ kind: 'player', value: v })),
    ...(user.faze_teams_followed ?? []).map((v) => ({ kind: 'team', value: v })),
    ...games.map((g) => ({ kind: 'game', value: g.game_name })),
  ];
}

// Each fact starts from one randomly chosen interest of the user (a favourite player, a team they follow, a game they own).
// With no interests on file it falls back to a random topic from the club's history.
const FALLBACK_TOPICS = ['the early YouTube trickshotting days', 'FaZe members and creators', 'esports championships', 'FaZe collaborations and viral moments', 'the FaZe logo and brand', 'FaZe house stories'];
function pickAngle(interests) {
  if (!interests.length) return { label: shuffle(FALLBACK_TOPICS)[0], personal: false };
  const pick = shuffle(interests)[0];
  return { label: pick.value, kind: pick.kind, personal: true };
}

// ---- generation --------------------------------------------------------------------------------

async function complete(messages) {
  if (!config.rag.openaiKey) throw new HttpError(503, 'Fun facts are not configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.rag.openaiKey}` },
    body: JSON.stringify({ model: config.rag.openaiModel, messages, temperature: 0.7, max_tokens: 160 }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Completion request failed (${res.status}): ${data.error?.message ?? 'unknown error'}`);
  return data.choices?.[0]?.message?.content?.trim();
}

const SYSTEM = `You write one fun fact about FaZe Clan for a fan's welcome screen.
Use ONLY the context provided; never add facts from memory. Every date, number and name you write must appear in the context. If the context holds nothing interesting, pick the most interesting thing it does contain.
Write 1-2 sentences, under 55 words, in a friendly, hype-but-not-cringe voice. Include a concrete detail such as a date, number or name.
Do not greet the fan, do not mention "the context" or "the document", and do not repeat any fact in the "already shown" list.
Reply with the fact only.`;

export async function generateFunFact(user) {
  const recent = await col('fun_facts').find({ user_id: user._id }).sort({ created_at: -1 }).limit(RECENT_FACTS).toArray();
  const usedChunks = new Set(recent.flatMap((f) => f.chunk_ids ?? []));
  const angle = pickAngle(await interestsOf(user));

  const query = angle.personal ? `FaZe Clan history about ${angle.label}${angle.kind === 'game' ? ' gameplay and competition' : ''}` : `FaZe Clan history: ${angle.label}`;
  const hits = await retrieve(query);
  // Prefer chunks this user has not been shown, then take a random few of the best so repeat visits differ.
  const fresh = hits.filter((h) => !usedChunks.has(h.chunk_id));
  const context = shuffle((fresh.length >= CONTEXT_CHUNKS ? fresh : hits).slice(0, 6)).slice(0, CONTEXT_CHUNKS);

  const prompt = [
    angle.personal ? `The fan is into: ${angle.label} (${angle.kind}). Prefer a fact connected to that if the context supports it; otherwise share the best fact you have.` : 'Share an interesting fact.',
    `\nContext:\n${context.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n')}`,
    recent.length ? `\nAlready shown:\n${recent.map((f) => `- ${f.fact}`).join('\n')}` : '',
  ].join('\n');

  // Guard against the model filling gaps from memory: every year or number it states must be in the retrieved text.
  const grounded = (f) => (f.match(/\d[\d,.]*/g) ?? []).every((n) => context.some((c) => c.text.includes(n.replace(/[.,]$/, ''))));
  let fact;
  for (let attempt = 0; attempt < 2 && !(fact && grounded(fact)); attempt++) {
    fact = await complete([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }]);
  }
  if (!fact || !grounded(fact)) throw new Error('Could not produce a grounded fact');

  const doc = { user_id: user._id, fact, angle: angle.label, chunk_ids: context.map((c) => c.chunk_id), created_at: new Date() };
  await col('fun_facts').insertOne(doc);
  return toPublic(doc);
}

const toPublic = (d) => ({ fact: d.fact, angle: d.angle, created_at: d.created_at });

export async function getFunFact(user, { fresh = false } = {}) {
  if (!fresh) {
    const last = await col('fun_facts').findOne({ user_id: user._id }, { sort: { created_at: -1 } });
    if (last && Date.now() - last.created_at.getTime() < FACT_REUSE_MS) return toPublic(last);
  }
  return generateFunFact(user);
}
