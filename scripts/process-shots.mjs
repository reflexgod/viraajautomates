// Processes the real screenshots and photos for the site. For every
// photos/<name>.png|jpg (demo screenshots) and photos/real/<name>.png|jpg
// (your own photos, such as real/qr-card.jpg) it writes
//   <out>/<name>-480.webp    480 px wide (preview card, tiles)
//   <out>/<name>-960.webp    960 px wide (2x screens)
//   <out>/<name>-1600.webp   up to 1600 px wide (lightbox)
//   <out>/<name>.jpg         960 px JPEG fallback for browsers without WebP
// where <out> is public/images/work/ or public/images/real/.
// It also writes public/js/real-photos.js, the list of real photos that exist,
// so the page can switch to a photo (for example the Local SEO preview uses
// real/qr-card.jpg once it is there) without any code change.
// WebP at quality 80. sharp drops all metadata (EXIF, GPS, XMP) unless told
// to keep it. Every file must stay under 200 KB; the script says if one doesn't.
// photos/ is not committed (see .gitignore). Run with: npm run shots
import { readdirSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { extname, basename } from 'node:path';
import sharp from 'sharp';

const LIMIT = 200 * 1024;
const report = (file, info) => {
  const kb = (info.size / 1024).toFixed(1);
  console.log(`${file}  ${info.width}x${info.height}  ${kb} KB${info.size > LIMIT ? '  OVER 200 KB' : ''}`);
};

async function processDir(src, out) {
  if (!existsSync(src)) return [];
  mkdirSync(out, { recursive: true });
  const names = [];
  for (const file of readdirSync(src)) {
    const ext = extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) continue;
    const name = basename(file, extname(file));
    const input = await sharp(src + file).rotate().toBuffer();
    for (const w of [480, 960, 1600]) {
      const dest = `${out}${name}-${w}.webp`;
      report(dest, await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest));
    }
    const jpg = `${out}${name}.jpg`;
    report(jpg, await sharp(input).resize({ width: 960, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toFile(jpg));
    names.push(name);
  }
  return names;
}

await processDir('photos/', 'public/images/work/');
const real = await processDir('photos/real/', 'public/images/real/');
writeFileSync('public/js/real-photos.js',
  '// Written by scripts/process-shots.mjs: the real photos in public/images/real/.\n' +
  `export const REAL_PHOTOS = ${JSON.stringify(real.sort())};\n`);
console.log(`Real photos: ${real.length ? real.join(', ') : 'none yet'}`);
