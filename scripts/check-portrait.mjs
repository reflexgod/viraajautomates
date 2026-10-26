// The About portrait ("Viraaj"): at 1440 and 1024 (hover) and 375 (tap) it is
// at most 240 px wide and 4:5, inside the screen and under the nav bar, and
// covers no text (the About line, and the next section's label); the photo is
// not fetched before the first hover or tap; a second tap hides it; with
// reduced motion it appears without a fade. Part of check-launch.mjs.
//   node scripts/check-portrait.mjs [baseUrl]
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

export async function checkPortrait({ browser, base = 'http://localhost:4173', report }) {
  for (const [w, h, touch] of [[1440, 900, false], [1024, 768, false], [375, 812, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage();
    let fetched = 0;
    page.on('request', (r) => { if (/viraaj-(480|960)\.webp/.test(r.url())) fetched++; });
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('motion'), null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { const el = document.querySelector('#about'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); });
    await page.waitForTimeout(1200);
    const early = fetched;
    const word = page.locator('.pw[data-preview="viraaj"] .pw__word');
    if (touch) await word.tap(); else await word.hover();
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const fig = document.querySelector('[data-portrait]');
      const r = fig.getBoundingClientRect();
      const nav = document.querySelector('[data-nav]').getBoundingClientRect();
      // Every line of text that must stay clear: the About line and the next section's label.
      const rects = ['#about .t-statement', '#services .rail'].flatMap((s) => { const rg = document.createRange(); rg.selectNodeContents(document.querySelector(s)); return [...rg.getClientRects()]; });
      const over = rects.some((q) => q.width && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top);
      return { w: Math.round(r.width), ratio: +(r.width / r.height).toFixed(3), shown: getComputedStyle(fig).opacity === '1', over, belowNav: r.top >= nav.bottom - 0.5, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    });
    const ok = m.shown && m.w <= 240 && Math.abs(m.ratio - 0.8) < 0.01 && !m.over && m.belowNav && m.inside && early === 0 && fetched > 0;
    report(`About portrait at ${w}: ≤ 240 px, 4:5, over no text, under the nav, inside the screen, photo loads on first ${touch ? 'tap' : 'hover'} only`, ok, JSON.stringify({ ...m, fetchedBefore: early, fetchedAfter: fetched }));
    if (touch) {
      await word.tap();
      await page.waitForTimeout(500);
      report('About portrait at 375: a second tap hides it', await page.evaluate(() => getComputedStyle(document.querySelector('[data-portrait]')).visibility === 'hidden'));
    }
    await ctx.close();
  }
  // Reduced motion: no fade (the global rule cuts transitions to 1 ms).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.evaluate(() => { const el = document.querySelector('#about'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); });
  await page.waitForTimeout(400);
  await page.locator('.pw[data-preview="viraaj"] .pw__word').hover();
  await page.waitForTimeout(60);
  const fade = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('[data-portrait]')); return { opacity: cs.opacity, duration: cs.transitionDuration }; });
  report('About portrait with reduced motion: shows at once, no fade', fade.opacity === '1', JSON.stringify(fade));
  await ctx.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkPortrait({ browser, base: process.argv[2] || 'http://localhost:4173', report });
  await browser.close();
  process.exitCode = failed ? 1 : 0;
}
