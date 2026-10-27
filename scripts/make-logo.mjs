// Builds the code-made logo (spec section 5).
// Text is converted to outlines, so the SVGs look the same without the font.
// Writes:
//   public/logo/mark.svg       rounded square with the S knocked out
//   public/logo/wordmark.svg   "Svayra"
// and refreshes the inline <symbol> sprite between the
// <!-- logo:start --> and <!-- logo:end --> markers in the HTML pages.
// Run with: npm run logo
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import opentype from 'opentype.js';

const FONT = 'node_modules/@fontsource/faculty-glyphic/files/faculty-glyphic-latin-400-normal.woff';
const buf = readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const r = (n) => Math.round(n * 100) / 100;

// Lays out text glyph by glyph with kerning. (opentype.js's own shaping
// fails on one of this font's substitution tables, and plain Latin needs none.)
function textPath(text, x, y, size) {
  const scale = size / font.unitsPerEm;
  const path = new opentype.Path();
  let prev = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, g) * scale;
    // Copy the raw outline (font units, y up) into place by hand; asking
    // opentype.js for positioned paths drops repeated and composite glyphs.
    for (const c of g.path.commands) {
      const t = { type: c.type };
      for (const [kx, ky] of [['x', 'y'], ['x1', 'y1'], ['x2', 'y2']]) {
        if (c[kx] !== undefined) { t[kx] = x + c[kx] * scale; t[ky] = y - c[ky] * scale; }
      }
      path.commands.push(t);
    }
    x += g.advanceWidth * scale;
    prev = g;
  }
  path.advance = x;
  return path;
}

// Serialises a path to SVG data (opentype.js's own toPathData can emit NaN).
function toD(path) {
  const n = (v) => String(r(v));
  return path.commands.map((c) => {
    if (c.type === 'M' || c.type === 'L') return c.type + n(c.x) + ' ' + n(c.y);
    if (c.type === 'Q') return 'Q' + [c.x1, c.y1, c.x, c.y].map(n).join(' ');
    if (c.type === 'C') return 'C' + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].map(n).join(' ');
    return 'Z';
  }).join('');
}

/* ---------- Mark: 32 x 32 rounded square, S knocked out ---------- */
const square = 'M4 0H28A4 4 0 0 1 32 4V28A4 4 0 0 1 28 32H4A4 4 0 0 1 0 28V4A4 4 0 0 1 4 0Z';

// Size the S so its cap is about 20 units tall, then centre it.
const capH = font.tables.os2.sCapHeight / font.unitsPerEm;
const size = 20 / capH;
const sb = textPath('S', 0, 0, size).getBoundingBox();
const ox = (32 - (sb.x2 - sb.x1)) / 2 - sb.x1;
const oy = (32 - (sb.y2 - sb.y1)) / 2 - sb.y1;
const markBody = square + toD(textPath('S', ox, oy, size)); // evenodd turns the letter into a hole
const MARK_VB = '0 0 32 32';

/* ---------- Wordmark: "Svayra", for the nav bar ---------- */
// The nav uses it under the old symbol id va-monogram, so the pages need no change.
const WS = 40; // design size in units
const wPath = textPath('Svayra', 0, 0, WS);
const wb = wPath.getBoundingBox();
const word = toD(wPath);
const WORD_VB = `${r(wb.x1 - 0.5)} ${r(wb.y1 - 0.5)} ${r(wb.x2 - wb.x1 + 1)} ${r(wb.y2 - wb.y1 + 1)}`;
const [, , ww, wh] = WORD_VB.split(' ').map(Number);

/* ---------- Standalone files ---------- */
const head = '<svg xmlns="http://www.w3.org/2000/svg"';
writeFileSync('public/logo/mark.svg',
  `${head} viewBox="${MARK_VB}" fill="currentColor"><title>Svayra</title>` +
  `<path fill-rule="evenodd" d="${markBody}"/></svg>\n`);
writeFileSync('public/logo/wordmark.svg',
  `${head} viewBox="${WORD_VB}" fill="currentColor"><title>Svayra</title>` +
  `<path d="${word}"/></svg>\n`);

/* ---------- Inline sprite for the HTML pages ---------- */
const sprite =
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">` +
  `<symbol id="va-mark" viewBox="${MARK_VB}"><path fill="currentColor" fill-rule="evenodd" d="${markBody}"/></symbol>` +
  `<symbol id="va-monogram" viewBox="${WORD_VB}"><path fill="currentColor" d="${word}"/></symbol>` +
  `<symbol id="va-wordmark" viewBox="${WORD_VB}"><path fill="currentColor" d="${word}"/></symbol></svg>` +
  `<style>:root{--wordmark-ratio:${r(ww / wh)};--monogram-ratio:${r(ww / wh)}}</style>`;

for (const page of ['public/index.html', 'public/privacy.html', 'public/404.html', 'public/work/smile-dental/index.html']) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  const next = html.replace(/<!-- logo:start -->[\s\S]*?<!-- logo:end -->/,
    `<!-- logo:start -->\n${sprite}\n<!-- logo:end -->`);
  writeFileSync(page, next);
  console.log('sprite updated in', page);
}

console.log(`mark viewBox ${MARK_VB}; wordmark viewBox ${WORD_VB} (aspect ${r(ww / wh)})`);
