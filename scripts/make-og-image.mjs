// Generates frontend/public/og-image.png (1200x630) with pure Node (zlib). No dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1200, H = 630;

const FONT = {
  A: ['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
  B: ['####.','#...#','#...#','####.','#...#','#...#','####.'],
  C: ['.####','#....','#....','#....','#....','#....','.####'],
  D: ['####.','#...#','#...#','#...#','#...#','#...#','####.'],
  E: ['#####','#....','#....','####.','#....','#....','#####'],
  F: ['#####','#....','#....','####.','#....','#....','#....'],
  G: ['.####','#....','#....','#.###','#...#','#...#','.####'],
  H: ['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
  I: ['#####','..#..','..#..','..#..','..#..','..#..','#####'],
  L: ['#....','#....','#....','#....','#....','#....','#####'],
  M: ['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
  O: ['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
  Q: ['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
  R: ['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
  S: ['.####','#....','#....','.###.','....#','....#','####.'],
  T: ['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
  U: ['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
  X: ['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
  Y: ['#...#','#...#','#...#','.###.','..#..','..#..','..#..'],
  ' ': ['.....','.....','.....','.....','.....','.....','.....'],
  '.': ['.....','.....','.....','.....','.....','.##..','.##..'],
  '·': ['.....','.....','.##..','.##..','.....','.....','.....'],
  '-': ['.....','.....','.....','###..','.....','.....','.....']
};

const px = new Uint8Array(W * H * 3);
function fillRect(x, y, w, h, col) {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
    }
  }
}
function textWidth(txt, scale) {
  let w = 0;
  for (const ch of txt) w += (FONT[ch] ? 6 : 7) * scale;
  return w;
}
function drawText(txt, cx, cy, scale, col) {
  let x = Math.round(cx - textWidth(txt, scale) / 2);
  const y0 = Math.round(cy - 3.5 * scale);
  for (const ch of txt) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] === '#') fillRect(x + gx * scale, y0 + gy * scale, scale, scale, col);
      }
    }
    x += (FONT[ch] ? 6 : 7) * scale;
  }
}

const GOLD = [201, 165, 74];
const WHITE = [243, 244, 246];
const MUTED = [154, 161, 173];
const BG = [12, 13, 17];

fillRect(0, 0, W, H, BG);
// frame + accent
fillRect(0, 0, W, 16, GOLD);
fillRect(0, H - 16, W, 16, GOLD);
fillRect(0, 0, 16, H, GOLD);
fillRect(W - 16, 0, 16, H, GOLD);
fillRect(28, 26, W - 56, 4, GOLD);

drawText('MISTFALL', W / 2, 210, 14, GOLD);
drawText('BUILD CALCULATOR', W / 2, 335, 12, WHITE);
fillRect(W / 2 - 190, 408, 380, 3, GOLD);
drawText('MISTFALLCALC.COM · BY SQUIGLE', W / 2, 472, 6, MUTED);
drawText('FREE · ALL SIX CLASSES', W / 2, 540, 6, WHITE);

// ---- PNG encode ----
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG() {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  let o = 0;
  for (let y = 0; y < H; y++) { raw[o++] = 0; for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; raw[o++] = px[i]; raw[o++] = px[i + 1]; raw[o++] = px[i + 2]; } }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
const out = join(HERE, '..', 'frontend', 'public', 'og-image.png');
writeFileSync(out, encodePNG());
console.log('wrote ' + out);
