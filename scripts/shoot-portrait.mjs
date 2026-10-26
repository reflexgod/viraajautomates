// The About portrait at 1440, 1024 and 375: hover (or tap) "Viraaj" and save
// a screenshot, and print where the portrait sits against the text and the nav.
//   node scripts/shoot-portrait.mjs [folder]   (needs npm run serve)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = `docs/screenshots/${process.argv[2] || 'portrait'}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [w, h, touch] of [[1440, 900, false], [1024, 768, false], [375, 812, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  const loaded = [];
  page.on('request', (r) => { if (/viraaj-(480|960)/.test(r.url())) loaded.push(r.url().split('/').pop()); });
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('motion') || document.documentElement.classList.contains('reveal-done'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { const el = document.querySelector('#about'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); });
  await page.waitForTimeout(1200);
  const before = loaded.length;
  const word = page.locator('.pw[data-preview="viraaj"] .pw__word');
  if (touch) await word.tap(); else await word.hover();
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const fig = document.querySelector('[data-portrait]') || document.querySelector('[data-pcard]');
    const r = fig.getBoundingClientRect(), t = document.querySelector('#about .t-statement').getBoundingClientRect();
    const n = document.querySelector('[data-nav]').getBoundingClientRect();
    const words = [...document.querySelectorAll('#about .t-statement')].flatMap((p) => { const rg = document.createRange(); rg.selectNodeContents(p); return [...rg.getClientRects()]; });
    const overText = words.some((q) => q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top);
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), opacity: getComputedStyle(fig).opacity, overText, belowNav: r.top >= n.bottom, inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, textLeft: Math.round(t.left) };
  });
  await page.screenshot({ path: `${out}/${w}-portrait.png` });
  console.log(w, JSON.stringify({ ...m, photoBeforeHover: before, photoAfter: loaded.length }));
  await ctx.close();
}
await browser.close();
