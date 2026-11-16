// Writes the two plain home-screen icons (dark square, white "M" block) to public/. Run: bun scripts/make-icons.ts
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const DARK = [23, 23, 23];
const LIGHT = [255, 255, 255];

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Is this pixel part of the letter M (two legs, two diagonals) on a unit square? */
function inM(x: number, y: number): boolean {
  const left = 0.26;
  const right = 0.74;
  const top = 0.28;
  const bottom = 0.72;
  const leg = 0.075;
  if (y < top || y > bottom) return false;
  if (Math.abs(x - left) <= leg || Math.abs(x - right) <= leg) return true;
  const t = (y - top) / (bottom - top); // 0 at the top, 1 at the bottom
  const mid = (left + right) / 2;
  const reach = (mid - left) * Math.min(1, t * 1.6);
  return (
    Math.abs(x - (left + (mid - left) * Math.min(1, t * 1.6))) <= leg * 0.9 ||
    Math.abs(x - (right - (right - mid) * Math.min(1, t * 1.6))) <= leg * 0.9 ||
    reach < 0
  );
}

function png(size: number): Uint8Array {
  const rows = new Uint8Array((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    rows[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const color = inM((x + 0.5) / size, (y + 0.5) / size) ? LIGHT : DARK;
      rows.set(color, row + 1 + x * 3);
    }
  }
  const head = new Uint8Array(13);
  const view = new DataView(head.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  head.set([8, 2, 0, 0, 0], 8); // 8 bit, RGB, no interlace
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

for (const size of [192, 512])
  writeFileSync(`public/icon-${size}.png`, png(size));
