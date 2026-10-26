// Local preview server that behaves like GitHub Pages:
//   /            -> index.html
//   /privacy     -> privacy.html (extensionless pages)
//   /work/x      -> 301 to /work/x/ (folders), then /work/x/index.html
//   anything else missing -> 404.html with status 404
//   text files gzipped and cached for 10 minutes, as GitHub Pages does
// Run with: npm run serve   (then open http://localhost:4173)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = 'public';
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

async function file(p) {
  try { return (await stat(p)).isFile() ? p : null; } catch { return null; }
}

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, '');
  const base = join(ROOT, safe);
  // A folder without its trailing slash redirects, as on GitHub Pages (relative links need it).
  if (!url.endsWith('/') && !extname(url) && (await file(join(base, 'index.html')))) { res.writeHead(301, { Location: url + '/' }); res.end(); return; }
  const found = (await file(base)) || (await file(join(base, 'index.html'))) || (await file(base + '.html'));
  const path = found || join(ROOT, '404.html');
  try {
    let body = await readFile(path);
    const type = TYPES[extname(path)] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600' };
    if (/text|javascript|json|svg|xml/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
    }
    res.writeHead(found ? 200 : 404, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
