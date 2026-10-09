/* eslint-disable no-console */
/**
 * Zero-dependency placeholder asset generator for white-label builds.
 * Draws a brand-colored tile emblem and writes the PNGs Expo/EAS require:
 *   icon.png (1024), adaptive-icon.png (1024), splash.png (1284x2778), favicon.png (48)
 * Usage: PRIMARY_COLOR=#1d4ed8 node scripts/make-assets.js
 * Replace the outputs with designer assets for store releases (see docs/BRANDING.md).
 */
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const zlib = require('zlib');

const PRIMARY = process.env.PRIMARY_COLOR || '#1d4ed8';
const ASSETS = join(__dirname, '..', 'assets');

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// CRC32 table
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, paint) {
  const [pr, pg, pb] = hex(PRIMARY);
  const WHITE = [255, 255, 255];
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x / width, y / height, pr, pg, pb, WHITE);
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

// Emblem: white rounded square with an inner brand square ("book" mark).
function emblem(u, v, pr, pg, pb, WHITE, pad = 0.22, radius = 0.09) {
  const inside = (x0, y0, x1, y1, r) => {
    const cx = Math.min(Math.max(u, x0 + r), x1 - r);
    const cy = Math.min(Math.max(v, y0 + r), y1 - r);
    return u >= x0 && u <= x1 && v >= y0 && v <= y1 && (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  };
  if (inside(pad, pad, 1 - pad, 1 - pad, radius)) {
    if (inside(pad + 0.14, pad + 0.14, 1 - pad - 0.14, 1 - pad - 0.14, radius / 2)) return [pr, pg, pb];
    return WHITE;
  }
  return [pr, pg, pb];
}

mkdirSync(ASSETS, { recursive: true });
const splashPaint = (u, v, pr, pg, pb, WHITE) => {
  // Center the emblem in the middle band of the tall splash canvas.
  const s = 1284 / 2778; // width/height
  const band = 0.5 - s / 2;
  const uu = u;
  const vv = (v - band) / (2 * (0.5 - band)) * 1; // normalize band to 0..1
  if (vv < 0 || vv > 1) return [pr, pg, pb];
  return emblem(uu, vv, pr, pg, pb, WHITE);
};

writeFileSync(join(ASSETS, 'icon.png'), png(1024, 1024, (u, v, ...c) => emblem(u, v, ...c)));
writeFileSync(join(ASSETS, 'adaptive-icon.png'), png(1024, 1024, (u, v, ...c) => emblem(u, v, ...c, 0.3, 0.06)));
writeFileSync(join(ASSETS, 'splash.png'), png(1284, 2778, splashPaint));
writeFileSync(join(ASSETS, 'favicon.png'), png(48, 48, (u, v, ...c) => emblem(u, v, ...c)));
console.log(`Assets written to ${ASSETS} with PRIMARY_COLOR=${PRIMARY}`);
