// Builds the temporary code-made logo (spec section 5).
// Text is converted to outlines, so the SVGs look the same without the font.
// Writes:
//   public/logo/mark.svg       VA monogram + status dot
//   public/logo/wordmark.svg   "Viraaj Automates"
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

/* ---------- Mark: 32 x 32 square, 4-unit corners, VA knocked out ---------- */
// The top-right corner is notched by a circle (r 6) around the status dot (r 4.5),
// which leaves the 1.5-unit gap between dot and square.
const DOT = { cx: 29, cy: 3, r: 4.5 };
const NOTCH_R = DOT.r + 1.5;
const dx = Math.sqrt(NOTCH_R ** 2 - DOT.cy ** 2);   // where the notch meets the top edge
const dy = Math.sqrt(NOTCH_R ** 2 - (32 - DOT.cx) ** 2); // where it meets the right edge
const square =
  `M4 0H${r(DOT.cx - dx)}A${NOTCH_R} ${NOTCH_R} 0 0 0 32 ${r(DOT.cy + dy)}` +
  'V28A4 4 0 0 1 28 32H4A4 4 0 0 1 0 28V4A4 4 0 0 1 4 0Z';

// Size "VA" so the caps are about 17 units tall, then centre it optically.
const capH = font.tables.os2.sCapHeight / font.unitsPerEm;
const size = 17 / capH;
const vaPath = textPath('VA', 0, 0, size);
const bb = vaPath.getBoundingBox();
const ox = (32 - (bb.x2 - bb.x1)) / 2 - bb.x1 - 0.6; // nudge left, away from the dot
const oy = (32 - (bb.y2 - bb.y1)) / 2 - bb.y1 + 0.4;
const va = toD(textPath('VA', ox, oy, size));
const markBody = square + va; // evenodd turns the letters into holes
const MARK_VB = '0 -2 36 34';

/* ---------- Monogram: the letters alone, for the nav bar ---------- */
// "VA" with the dot sitting off the A's shoulder, like the mark's.
const MS = 40;
const mPath = textPath('VA', 0, 0, MS);
const mb = mPath.getBoundingBox();
const MONO_DOT = { cx: r(mb.x2 + 3.2), cy: r(mb.y1 + 2.6), r: 2.6 };
const monogram = toD(mPath);
const MONO_VB = `${r(mb.x1 - 0.5)} ${r(mb.y1 - 0.5)} ${r(MONO_DOT.cx + MONO_DOT.r - mb.x1 + 1)} ${r(mb.y2 - mb.y1 + 1)}`;

/* ---------- Wordmark ---------- */
const WS = 44; // design size in units
const vPath = textPath('Viraaj', 0, 0, WS);
const space = font.charToGlyph(' ').advanceWidth / font.unitsPerEm * WS;
const vAdvance = vPath.advance;
const aPath = textPath('Automates', vAdvance + space, 0, WS);
const b1 = vPath.getBoundingBox(), b2 = aPath.getBoundingBox();
const x0 = Math.min(b1.x1, b2.x1), y0 = Math.min(b1.y1, b2.y1);
const x1 = Math.max(b1.x2, b2.x2), y1 = Math.max(b1.y2, b2.y2);
const WORD_VB = `${r(x0 - 0.5)} ${r(y0 - 0.5)} ${r(x1 - x0 + 1)} ${r(y1 - y0 + 1)}`;
const viraaj = toD(vPath);
const automates = toD(aPath);

/* ---------- Standalone files ---------- */
const head = '<svg xmlns="http://www.w3.org/2000/svg"';
writeFileSync('public/logo/mark.svg',
  `${head} viewBox="${MARK_VB}" fill="currentColor"><title>Viraaj Automates</title>` +
  `<path fill-rule="evenodd" d="${markBody}"/>` +
  `<circle class="va-dot" cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}"/></svg>\n`);
writeFileSync('public/logo/wordmark.svg',
  `${head} viewBox="${WORD_VB}" fill="currentColor"><title>Viraaj Automates</title>` +
  `<path d="${viraaj}"/><path fill-opacity=".68" d="${automates}"/></svg>\n`);

/* ---------- Inline sprite for the HTML pages ---------- */
// The dot reads --va-dot (currentColor unless a page sets it).
const sprite =
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">` +
  `<symbol id="va-mark" viewBox="${MARK_VB}"><path fill="currentColor" fill-rule="evenodd" d="${markBody}"/>` +
  `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" style="fill:var(--va-dot,currentColor)"/></symbol>` +
  `<symbol id="va-monogram" viewBox="${MONO_VB}"><path fill="currentColor" d="${monogram}"/>` +
  `<circle cx="${MONO_DOT.cx}" cy="${MONO_DOT.cy}" r="${MONO_DOT.r}" style="fill:var(--va-dot,currentColor)"/></symbol>` +
  `<symbol id="va-wordmark" viewBox="${WORD_VB}"><path fill="currentColor" d="${viraaj}"/>` +
  `<path fill="currentColor" fill-opacity=".68" d="${automates}"/></symbol></svg>` +
  `<style>:root{--wordmark-ratio:${r((x1 - x0 + 1) / (y1 - y0 + 1))};--monogram-ratio:${r(MONO_VB.split(" ")[2] / MONO_VB.split(" ")[3])}}</style>`;

for (const page of ['public/index.html', 'public/privacy.html', 'public/404.html', 'public/work/smile-dental/index.html']) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  const next = html.replace(/<!-- logo:start -->[\s\S]*?<!-- logo:end -->/,
    `<!-- logo:start -->\n${sprite}\n<!-- logo:end -->`);
  writeFileSync(page, next);
  console.log('sprite updated in', page);
}

const [, , ww, wh] = WORD_VB.split(' ').map(Number);
console.log(`mark viewBox ${MARK_VB}; wordmark viewBox ${WORD_VB} (aspect ${r(ww / wh)})`);
