import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validators } from '../src/schemas.js';
import { chunkHistory } from '../src/services/rag.js';

const SAMPLE = `
FaZe Clan: A Timeline, 2010–2026
01  2010-11 — FaZe Sniping: three kids and an Intervention
2010
May 2010 · Founded as FaZe Sniping
Eric Rivera, Jeff Emann and Ben Christensen start a Call of Duty trickshotting crew on YouTube. They upload constantly.
Jun 2, 2010 · ILLCAMS Episode 1
1.40M lifetime views, uploaded three days after the channel opened. The format drives subscribers for four years.
02  2015 — Esports
Mar 2015 · FaZe Red take 3rd at the Call of Duty Championship
The roster climbs onto its first championship podium and the org starts to be taken seriously by the scene.
`;

test('timeline entries are chunked with their section and year', () => {
  const chunks = chunkHistory(SAMPLE);
  assert.equal(chunks.length, 2); // 2010 entries merge; the new section starts a new chunk
  assert.match(chunks[0].text, /Founded as FaZe Sniping[\s\S]*ILLCAMS/);
  assert.equal(chunks[0].year, 2010);
  assert.equal(chunks[1].year, 2015);
  assert.equal(new Set(chunks.map((c) => c.chunk_id)).size, chunks.length);
});

test('stored chunks and facts have validators', () => {
  assert.ok(validators.faze_history_chunks.required.includes('embedding'));
  assert.ok(validators.fun_facts.required.includes('user_id'));
});
