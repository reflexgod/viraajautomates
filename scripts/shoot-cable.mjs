// Drives the hero cable with a mouse and saves frames: push, grab and
// pull, release and swing back, and pulling the plug. Needs npm run serve.
//   node scripts/shoot-cable.mjs [outDir]   (the automated check is check-cable.mjs)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] || 'docs/screenshots/cable-check';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForSelector('[data-hero].is-live', { timeout: 15000 });
await page.waitForTimeout(4000); // the drop-in entrance settles

// At 1440 x 900 the wide frame sits at x 540..1440 with scale 1.
const at = (x, y) => [540 + x, y];
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

// 1. Hover: sweep the pointer through the curl.
for (let i = 0; i <= 10; i++) { await page.mouse.move(...at(200 + i * 30, 420)); await page.waitForTimeout(16); }
await shot('1-push');

// 2. Grab the left of the curl and pull it out to the left and down.
await page.mouse.move(...at(250, 370));
const cursor = await page.evaluate(() => document.querySelector('[data-hero]').dataset.cursor || 'none');
await page.mouse.down();
for (let i = 1; i <= 16; i++) { await page.mouse.move(...at(250 - i * 8, 370 + i * 9)); await page.waitForTimeout(20); }
await page.waitForTimeout(300);
await shot('2-pulled');
await page.mouse.up();
await page.waitForTimeout(250);
await shot('3-released-swing');
await page.waitForTimeout(2500);
await shot('4-settled');

// 3. Pull the plug up, let go: it should glide back to where it rests.
await page.mouse.move(...at(250, 860));
await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(...at(250 + i * 6, 860 - i * 22)); await page.waitForTimeout(20); }
await page.waitForTimeout(300);
await shot('5-plug-lifted');
await page.mouse.up();
await page.waitForTimeout(1500);
await shot('6-plug-home');

console.log('cursor label over cable:', cursor);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
