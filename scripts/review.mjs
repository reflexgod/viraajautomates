// Self-review screenshots at 1440 and 375: the intro at 0.3, 1.0 and 1.6 s,
// every home section, the hover card on each service title, each "How it
// works" step, the free-check message, and the case study top to bottom.
// Also prints each section's height and any console errors or sideways overflow.
// Saves to docs/screenshots/<folder>/. Needs the preview server (npm run serve).
//   node scripts/review.mjs [folder] [--widths 1440,375]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const folder = args[0] && !args[0].startsWith('--') ? args[0] : 'review';
const wi = args.indexOf('--widths');
const widths = (wi >= 0 ? args[wi + 1] : '1440,375').split(',').map(Number);
const HEIGHTS = { 1440: 900, 375: 812, 768: 1024, 360: 780, 414: 896, 1024: 768 };
const out = `docs/screenshots/${folder}`;
mkdirSync(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 72 });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// Scroll so the element's top sits at `frac` of the viewport, then let things settle.
async function at(page, sel, frac = 0.12, wait = 1400) {
  await page.evaluate(({ sel, frac }) => {
    const el = document.querySelector(sel);
    const y = el.getBoundingClientRect().top + scrollY - innerHeight * frac;
    window.scrollTo(0, Math.max(0, y));
  }, { sel, frac });
  await page.waitForTimeout(wait);
}

for (const w of widths) {
  const mobile = w < 768;
  const h = HEIGHTS[w] || 900;
  const errors = [];
  const ctxOpts = { viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile };

  // 1. The intro, as a first visit
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const t0 = Date.now();
    await page.goto('http://localhost:4173/', { waitUntil: 'commit' });
    await page.waitForSelector('[data-intro]', { state: 'attached', timeout: 5000 }).catch(() => {});
    for (const t of [300, 1000, 1600]) {
      const wait = t - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await shot(page, `${w}-intro-${t}`);
    }
    await ctx.close();
  }

  // 2. Home sections (intro already seen this session)
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto('http://localhost:4173/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  await shot(page, `${w}-01-hero`);

  // Section heights (pin spacing included)
  const heights = await page.evaluate(() => [...document.querySelectorAll('main > section, footer')].map((s) => {
    const box = s.parentElement.classList.contains('pin-spacer') ? s.parentElement : s;
    const spacer = s.querySelector('.pin-spacer');
    return `${s.id || s.className.split(' ')[0]}: ${Math.round(box.offsetHeight)}px${spacer ? ` (incl. ${Math.round(spacer.offsetHeight - spacer.firstElementChild.offsetHeight)}px pin)` : ''}`;
  }).concat(`total: ${document.documentElement.scrollHeight}px`));
  console.log(`${w} section heights:\n  ${heights.join('\n  ')}`);

  for (const [name, sel, frac] of [
    ['02-about', '#about', 0.1],
    ['03-services', '#services', 0.06],
    ['04-rows-1', '[data-row]:nth-child(1)', 0.3],
    ['05-rows-3', '[data-row]:nth-child(3)', 0.3],
    ['06-terms', '#terms', 0.3],
  ]) { await at(page, sel, frac); await shot(page, `${w}-${name}`); }

  // The About photo card (hover on desktop, tap on phones)
  await at(page, '#about', 0.2, 900);
  {
    const box = await page.$eval('[data-preview="viraaj"] .pw__word', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (!mobile) { await page.mouse.move(box[0] - 30, box[1] + 60); await page.mouse.move(box[0], box[1], { steps: 6 }); }
    else await page.touchscreen.tap(box[0], box[1]);
    await page.waitForTimeout(900);
    await shot(page, `${w}-02b-about-photo`);
    if (!mobile) await page.mouse.move(5, 5); else await page.touchscreen.tap(20, h - 20);
    await page.waitForTimeout(400);
  }

  // How it works: each step
  await at(page, '#how', 0.05, 1400);
  await shot(page, `${w}-07-how-head`);
  if (!mobile) {
    const pin = await page.evaluate(() => { const st = window.ScrollTrigger.getAll().find((t) => t.pin); return [st.start, st.end]; });
    for (const i of [0, 1, 2, 3]) {
      // Early in each step's part of the pin (how.js: SPAN 3.3)
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(pin[0] + (pin[1] - pin[0]) * Math.min(0.97, (i + 0.25) / 3.3)));
      await page.waitForTimeout(1800);
      await shot(page, `${w}-08-how-step${i + 1}`);
    }
  } else {
    await at(page, '[data-how-board]', 0.12, 1000);
    for (const i of [0, 1, 2, 3]) {
      await page.evaluate((i) => document.querySelectorAll('[data-how-tab]')[i].click(), i);
      await page.waitForTimeout(1600);
      await shot(page, `${w}-08-how-step${i + 1}`);
    }
  }
  await at(page, '.how__foot', 0.5, 1200);
  await shot(page, `${w}-09-how-foot`);

  for (const [name, sel, frac, wait] of [
    ['10-process', '#process', 0.08, 1600],
    ['11-faq', '#questions', 0.08, 1200],
    ['12-check', '#check', 0.1, 1400],
  ]) { await at(page, sel, frac, wait); await shot(page, `${w}-${name}`); }
  if (!mobile) {
    const b = await page.$eval('#check .btn', (e) => { const r = e.getBoundingClientRect(); return [r.left + 40, r.top + r.height / 2]; });
    await page.mouse.move(b[0], b[1], { steps: 4 });
    await page.waitForTimeout(1200);
    await shot(page, `${w}-13-check-message`);
    await page.mouse.move(5, 5);
  }
  await at(page, '#contact', 0.02, 2200);
  await shot(page, `${w}-14-footer`);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1600);
  await shot(page, `${w}-15-footer-end`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await ctx.close();

  // 3. Case study, top to bottom
  const cctx = await browser.newContext(ctxOpts);
  const cp = await cctx.newPage();
  cp.on('console', (m) => { if (m.type() === 'error') errors.push(`case console: ${m.text()}`); });
  cp.on('pageerror', (e) => errors.push(`case pageerror: ${e.message}`));
  await cp.goto('http://localhost:4173/work/smile-dental/', { waitUntil: 'load' });
  await cp.waitForTimeout(1500);
  const H = await cp.evaluate(() => document.documentElement.scrollHeight);
  let n = 0;
  for (let y = 0; y < H; y += Math.round(h * 0.9)) {
    await cp.evaluate((y) => window.scrollTo(0, y), y);
    await cp.waitForTimeout(1300);
    await cp.screenshot({ path: `${out}/${w}-case-${String(n++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 72 });
  }
  const cOverflow = await cp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`${w}: case study ${H}px tall`);
  await cctx.close();

  console.log(`${w}: done. Sideways overflow: home ${overflow}px, case study ${cOverflow}px`);
  errors.forEach((e) => console.log('  ' + e));
}
await browser.close();
