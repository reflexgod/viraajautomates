// Cuts the two web fonts (Inter, Faculty Glyphic; labels use the device's own
// monospace) down to the characters the site uses (every page and script in
// public/), plus all of ASCII and Latin-1 and common punctuation as a
// margin, keeping Inter's weight axis and the features the CSS asks for
// (cv11, ss01, tabular figures). Smaller fonts leave more of a phone's first
// second for the hero picture. Needs Python with fontTools and brotli
// (pip install fonttools brotli). Run with: npm run subset-fonts
// (copy-vendor.mjs copies the full fonts; run this after it.)
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const nm = 'node_modules/';
const FONTS = [
  ['@fontsource/faculty-glyphic/files/faculty-glyphic-latin-400-normal.woff2', 'public/fonts/faculty-glyphic-latin-400.woff2'],
  ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'public/fonts/inter-latin-wght.woff2'],
];

// Every character in the site's pages and scripts (the vendor libraries aside).
const chars = new Set();
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'vendor') walk(p); } else if (/\.(html|js)$/.test(f)) for (const c of readFileSync(p, 'utf8')) chars.add(c.codePointAt(0));
  }
})('public');
for (let c = 0x20; c <= 0x7e; c++) chars.add(c);
for (let c = 0xa0; c <= 0xff; c++) chars.add(c);
for (const c of '‐–—‘’‚“”„†•…‰′″‹›€₹™−×÷←↑→↓↗↘✓✔') chars.add(c.codePointAt(0));
const unicodes = [...chars].filter((c) => c >= 0x20).sort((a, b) => a - b).map((c) => c.toString(16).padStart(4, '0')).join(',');

const dir = mkdtempSync(join(tmpdir(), 'va-fonts-'));
writeFileSync(join(dir, 'unicodes.txt'), unicodes);
for (const [from, to] of FONTS) {
  const before = statSync(nm + from).size;
  execFileSync('python', ['-m', 'fontTools.subset', nm + from,
    `--unicodes-file=${join(dir, 'unicodes.txt')}`,
    '--layout-features+=cv11,ss01,tnum',
    '--flavor=woff2', `--output-file=${to}`]);
  console.log(`${to}  ${(before / 1024).toFixed(1)} KB -> ${(statSync(to).size / 1024).toFixed(1)} KB`);
}
