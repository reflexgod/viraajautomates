// Renders the hero cable at rest, from the same WebGL scene the site uses,
// into still images for first paint, reduced motion and no-WebGL browsers:
//   public/images/cable-wide.webp   the region FRAMES.wide.still (js/cable/layout.js)
//   public/images/cable-tall.webp   the region FRAMES.tall.still  (wide and tall also as .avif)
//   public/images/cable-drop.webp   the plug end hanging into the footer, x 0..240, y 0..520
// The page places wide and tall with their socket point on the button's socket
// (the script after the hero in index.html holds the same regions: keep them in step).
// Needs the preview server (npm run serve). Run with: npm run still
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { FRAMES } from '../public/js/cable/layout.js';

const SHOTS = [
  { name: 'wide', region: FRAMES.wide.still, scale: 1.25, tier: 'high' },
  { name: 'tall', region: FRAMES.tall.still, scale: 2, tier: 'low' },
  { name: 'drop', region: { x0: 0, y0: 0, x1: 240, y1: 520 }, scale: 2, tier: 'low' },
];
const TIERS = {
  high: { name: 'high', dpr: 1, realShadows: true, shadowMap: 2048 },
  low: { name: 'low', dpr: 1, realShadows: false },
};

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const shot of SHOTS) {
  const { x0, y0, x1, y1 } = shot.region;
  const w = Math.round((x1 - x0) * shot.scale), h = Math.round((y1 - y0) * shot.scale);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  // A bare page on the preview server's origin, so the site's modules load.
  await page.route('**/__still.html', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><style>
      :root { --cream: #F5EDE2; --ground: #2E1A22; --graphite: #141110; }
      html, body { margin: 0; background: transparent; }
      [data-hero] { position: relative; width: ${w}px; height: ${h}px; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
    <div data-hero><canvas data-cable-canvas></canvas></div>
    <script type="module">
      import { createCable } from '/js/cable/cable.js';
      const c = await createCable(document.querySelector('[data-hero]'),
        { frame: '${shot.name}', tier: ${JSON.stringify(TIERS[shot.tier])}, still: ${JSON.stringify(shot.region)} });
      window.__png = c.canvas.toDataURL('image/png');
    </script>`,
  }));
  await page.goto('http://localhost:4173/__still.html');
  await page.waitForFunction(() => window.__png, null, { timeout: 30000 });
  const png = Buffer.from((await page.evaluate(() => window.__png)).split(',')[1], 'base64');
  const out = `public/images/cable-${shot.name}.webp`;
  const info = await sharp(png).webp({ quality: 78, alphaQuality: 80, effort: 6 }).toFile(out);
  console.log(`${out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
  // The hero's two are the page's largest paint: an AVIF about half the size goes first in the <picture>.
  if (shot.name !== 'drop') {
    const avif = out.replace('.webp', '.avif');
    const ai = await sharp(png).avif({ quality: 52, effort: 6 }).toFile(avif);
    console.log(`${avif}  ${ai.width}x${ai.height}  ${(ai.size / 1024).toFixed(1)} KB`);
  }
  await page.close();
}
await browser.close();
