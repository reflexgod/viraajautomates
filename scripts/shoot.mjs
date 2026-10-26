// Screenshots for the review checkpoints, using the installed Chrome.
//   node scripts/shoot.mjs <folder> [--path /] [--widths 1440,375] [--full]
//        [--at "#services"] [--reduced] [--wait 2600] [--query "tier=low"]
// Saves to docs/screenshots/<folder>/<width>.png and prints console errors.
// Needs the preview server running (npm run serve).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const folder = args[0] || 'misc';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const widths = opt('widths', '1440,375').split(',').map(Number);
const HEIGHTS = { 1440: 900, 1920: 1080, 1024: 768, 768: 1024, 414: 896, 375: 812, 360: 780 };
const path = opt('path', '/');
const query = opt('query', '');
const at = opt('at', '');
const wait = Number(opt('wait', '2600'));
const outDir = `docs/screenshots/${folder}`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const w of widths) {
  const mobile = w < 768;
  const context = await browser.newContext({
    viewport: { width: w, height: HEIGHTS[w] || 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:4173${path}${query ? `?${query}` : ''}`, { waitUntil: 'load' });
  if (at) {
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), at);
  }
  await page.waitForTimeout(wait);
  const file = `${outDir}/${w}${at ? '-' + at.replace(/\W/g, '') : ''}.png`;
  await page.screenshot({ path: file, fullPage: flag('full') });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`${file}${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ''}`);
  errors.forEach((e) => console.log('  ' + e));
  await context.close();
}
await browser.close();
