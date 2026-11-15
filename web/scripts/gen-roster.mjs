// Builds the "Meet the team" data from ../members.txt and ../faze-roster/.
// Run: npm run roster   (re-run after editing members.txt or the photos)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';

const root = new URL('../../', import.meta.url);
const out = new URL('../', import.meta.url);

// ---- members.txt: alternating lines, "FaZe <name>" then comma-separated roles ----
const lines = readFileSync(new URL('members.txt', root), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
if (lines.length % 2) throw new Error('members.txt must have an even number of non-empty lines (name, roles)');
const members = [];
for (let i = 0; i < lines.length; i += 2) {
  if (!lines[i].startsWith('FaZe ')) throw new Error(`Unexpected name line: ${lines[i]}`);
  members.push({ name: lines[i].slice(5).trim(), roles: [...new Set(lines[i + 1].split(',').map((r) => r.trim()).filter(Boolean))] });
}

// ---- featured people: best available photo for each (licensed + FaZe jersey preferred) ----
const FEATURED = [
  ['Apex', 'faze-apex.jpg'], ['Banks', 'faze-banks.jpg'], ['Rain', 'faze-rain-nordan.png'], ['Temperrr', 'faze-temperrr.jpg'],
  ['ZooMaa', 'faze-zoomaa.jpg'], ['broky', 'faze-broky.jpg'], ['karrigan', 'faze-karrigan.jpg'], ['Twistzz', 'faze-twistzz.jpg'],
  ['frozen', 'faze-frozen.png'], ['jcobbb', 'faze-jcobbb.png'],
];

// ---- CC BY credits for the licensed photos. Copied from faze-roster/ATTRIBUTION.txt, which is no longer
// in the folder; CC BY requires the credit to be shown wherever the photo is, so it lives here now. ----
const credits = {
  'faze-rain-nordan.png': { photographer: 'Gamma Labs', title: 'Nordan.png', license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Nordan.png', terms: 'https://creativecommons.org/licenses/by/4.0/' },
  'faze-broky.jpg': { photographer: 'VaKarM.net', title: 'Broky with Faze PGL Major Antwerp (05-2022) (cropped).jpg', license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Broky_with_Faze_PGL_Major_Antwerp_(05-2022)_(cropped).jpg', terms: 'https://creativecommons.org/licenses/by/2.0/' },
  'faze-karrigan.jpg': { photographer: 'VaKarM.net', title: 'Karrigan with Faze PGL Major Antwerp (05-2022) (cropped).jpg', license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Karrigan_with_Faze_PGL_Major_Antwerp_(05-2022)_(cropped).jpg', terms: 'https://creativecommons.org/licenses/by/2.0/' },
  'faze-twistzz.jpg': { photographer: 'Esports Kingdom', title: 'Twistzz IMG 1465 (47926460051) (cropped).jpg', license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Twistzz_IMG_1465_(47926460051)_(cropped).jpg', terms: 'https://creativecommons.org/licenses/by/2.0/' },
};

mkdirSync(new URL('public/team/', out), { recursive: true });
const featured = FEATURED.map(([key, file]) => {
  const member = members.find((m) => m.name.toLowerCase() === key.toLowerCase());
  if (!member) throw new Error(`${key} is not in members.txt`);
  const src = new URL(`faze-roster/${file}`, root);
  const dest = `team/${key.toLowerCase()}${extname(file)}`;
  const destUrl = new URL(`public/${dest}`, out);
  copyFileSync(src, destUrl);
  if (statSync(destUrl).size > 80_000) { // big originals: shrink to a card-sized image
    try { execFileSync('sips', ['-Z', '520', destUrl.pathname, '--out', destUrl.pathname], { stdio: 'ignore' }); } catch { /* sips is macOS-only; keep the original */ }
  }
  return { name: member.name, roles: member.roles, photo: `/${dest}`, credit: credits[file] ?? null };
});

writeFileSync(new URL('src/data/roster.json', out), JSON.stringify({ total: members.length, featured, members }, null, 1));
console.log(`roster.json: ${members.length} members, ${featured.length} featured, ${featured.filter((f) => f.credit).length} with CC BY credits`);
