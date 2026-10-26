// Copies the font files and browser libraries the live site needs from
// node_modules into public/, and builds a small Three.js bundle.
// Run with: npm run vendor, then npm run subset-fonts (the fonts ship cut down to the site's characters)
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { build } from 'esbuild';

const nm = 'node_modules/';
const copies = [
  // Fonts (Latin subset only, SIL Open Font License)
  ['@fontsource/faculty-glyphic/files/faculty-glyphic-latin-400-normal.woff2', 'public/fonts/faculty-glyphic-latin-400.woff2'],
  ['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'public/fonts/inter-latin-wght.woff2'],
  // Motion libraries
  ['gsap/dist/gsap.min.js', 'public/js/vendor/gsap.min.js'],
  ['lenis/dist/lenis.min.js', 'public/js/vendor/lenis.min.js'],
];

mkdirSync('public/fonts', { recursive: true });
mkdirSync('public/js/vendor', { recursive: true });
for (const [from, to] of copies) {
  copyFileSync(nm + from, to);
  console.log(`${to}  ${(statSync(to).size / 1024).toFixed(1)} KB`);
}

await build({
  entryPoints: ['scripts/three-entry.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  legalComments: 'none',
  outfile: 'public/js/vendor/three.hero.js',
});
console.log(`public/js/vendor/three.hero.js  ${(statSync('public/js/vendor/three.hero.js').size / 1024).toFixed(1)} KB`);
