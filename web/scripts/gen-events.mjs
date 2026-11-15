// Pulls the "Happening at FaZe" events out of a FaZe Lobby html export into src/data/recent-events.json.
// Run: npm run events -- "/path/to/FaZe Lobby.html"   (defaults to ~/Downloads/FaZe Lobby (1).html)
// The html is only read as text and parsed with patterns; none of its JavaScript is executed.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const file = process.argv[2] ?? `${homedir()}/Downloads/FaZe Lobby (1).html`;
const html = readFileSync(file, 'utf8');

const array = html.match(/const EV=\[(.*?)\];/s)?.[1];
if (!array) throw new Error(`No "const EV=[...]" events array found in ${file}`);

const unescape = (s) => s.slice(1, -1).replace(/\\(.)/g, '$1'); // 'it\'s' -> it's
const events = [...array.matchAll(/\{([^{}]*)\}/g)].map(([, body]) => {
  const f = Object.fromEntries([...body.matchAll(/(\w+):('(?:[^'\\]|\\.)*'|\d+)/g)].map(([, k, v]) => [k, v.startsWith("'") ? unescape(v) : Number(v)]));
  for (const k of ['id', 't', 'w', 'd']) if (!f[k]) throw new Error(`Event is missing "${k}": ${body.slice(0, 80)}`);
  return { id: f.id, title: f.t, when: f.w, detail: f.d, upcoming: Boolean(f.live) };
});

writeFileSync(new URL('../src/data/recent-events.json', import.meta.url), JSON.stringify(events, null, 1));
console.log(`recent-events.json: ${events.length} events (${events.filter((e) => e.upcoming).length} upcoming) from ${file.split('/').pop()}`);
