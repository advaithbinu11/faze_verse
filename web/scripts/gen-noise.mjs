// Generates a tileable 256px greyscale value-noise PNG used by the dissolve shader (no binary asset in git history).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const N = 256, CELL = 32;
let seed = 1337;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const G = CELL === 0 ? 0 : N / CELL;
const grid = Array.from({ length: G * G }, rnd);
const at = (x, y) => grid[(((y % G) + G) % G) * G + (((x % G) + G) % G)];
const smooth = (t) => t * t * (3 - 2 * t);
const octave = (px, py, cell) => {
  const gx = px / cell, gy = py / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
  const tx = smooth(gx - x0), ty = smooth(gy - y0);
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
};
const raw = Buffer.alloc((N + 1) * N); // filter byte + N greyscale pixels per row
for (let y = 0; y < N; y++) {
  raw[y * (N + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const v = octave(x, y, 32) * 0.6 + octave(x, y, 16) * 0.3 + octave(x, y, 8) * 0.1;
    raw[y * (N + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 0;
writeFileSync(new URL('../public/textures/noise.png', import.meta.url), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('noise.png written');
