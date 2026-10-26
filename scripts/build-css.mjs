// Joins the stylesheets in styles/ into one minified file, public/css/site.css,
// the only stylesheet every page loads (one request, nothing render-blocking
// waits on a second file). Edit styles/*.css, then: npm run css
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

// Order matters: tokens first, the case study page last.
const PARTS = ['tokens', 'fallbacks', 'base', 'components', 'sections', 'case'];

export async function buildCss() {
  const source = PARTS.map((p) => readFileSync(`styles/${p}.css`, 'utf8')).join('\n');
  const { code } = await transform(source, { loader: 'css', minify: true, legalComments: 'none' });
  return code;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync('public/css', { recursive: true });
  writeFileSync('public/css/site.css', await buildCss());
  console.log(`public/css/site.css  ${(statSync('public/css/site.css').size / 1024).toFixed(1)} KB`);
}
