// Favicons from the code-made mark (spec 5 and 10.6):
//   public/favicon.svg          mark in chalk on the --ground rounded square, dot in chalk
//   public/favicon.ico          32 px (a PNG inside an ICO wrapper)
//   public/apple-touch-icon.png 180 px
// Run with: npm run icons
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const GROUND = "#2E1A22", CHALK = "#F5EDE2";
const mark = readFileSync('public/logo/mark.svg', 'utf8');
const body = mark.match(/<path[^>]*\/>/)[0].replace('<path', `<path fill="${CHALK}"`);
const dot = mark.match(/<circle[^>]*\/>/)[0].replace('class="va-dot"', `fill="${CHALK}"`);

// The mark's viewBox is "0 -2 36 34"; centre it in a 64 x 64 tile.
const icon = (radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" rx="${radius}" fill="${GROUND}"/>` +
  `<g transform="translate(14 17) scale(1)">${body}${dot}</g></svg>`;

writeFileSync('public/favicon.svg', icon(12) + '\n');

// Apple adds its own rounding, so the touch icon is a full square.
await sharp(Buffer.from(icon(0)), { density: 400 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');

const png32 = await sharp(Buffer.from(icon(12)), { density: 200 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);          // reserved
header.writeUInt16LE(1, 2);          // type: icon
header.writeUInt16LE(1, 4);          // one image
header.writeUInt8(32, 6);            // width
header.writeUInt8(32, 7);            // height
header.writeUInt8(0, 8);             // no palette
header.writeUInt8(0, 9);             // reserved
header.writeUInt16LE(1, 10);         // colour planes
header.writeUInt16LE(32, 12);        // bits per pixel
header.writeUInt32LE(png32.length, 14);
header.writeUInt32LE(22, 18);        // image data offset
writeFileSync('public/favicon.ico', Buffer.concat([header, png32]));
console.log('favicon.svg, favicon.ico, apple-touch-icon.png written');
