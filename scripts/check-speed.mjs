// Round 12, "speed and seamless": the hero is there from first paint, the live
// cord swaps in without a jump, text does not move when the fonts arrive, page
// changes cross-fade and the case study prerenders on hover, the back button
// lands where you were, phones scroll natively, the pin holds still, and
// scrolling makes no long tasks. Part of check-launch.mjs; on its own:
//   node scripts/check-speed.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { buildCss } from './build-css.mjs';

const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESK = { viewport: { width: 1440, height: 900 } };
const sizes = [['1440', DESK], ['375', PHONE]];

export async function checkSpeed({ browser, base = 'http://localhost:4173', report }) {
  /* ---------- Files: one stylesheet, the two main fonts preloaded ---------- */
  const pages = ['public/index.html', 'public/work/smile-dental/index.html', 'public/privacy.html', 'public/404.html'];
  const bad = pages.filter((f) => {
    const h = readFileSync(f, 'utf8');
    return (h.match(/rel="stylesheet"/g) || []).length !== 1 || !/css\/site\.css/.test(h);
  });
  report('One stylesheet (css/site.css) on every page', bad.length === 0, bad.join(' '));
  report('css/site.css is up to date with styles/ (npm run css)', (await buildCss()) === readFileSync('public/css/site.css', 'utf8'));
  const heads = pages.slice(0, 2).map((f) => readFileSync(f, 'utf8'));
  report('Home and case study preload Inter and Faculty Glyphic', heads.every((h) => /rel="preload" href="[^"]*inter-latin-wght\.woff2"/.test(h) && /rel="preload" href="[^"]*faculty-glyphic-latin-400\.woff2"/.test(h)));
  // Quotes and spaces out, so the minifier's choices do not matter.
  const css = readFileSync('public/css/site.css', 'utf8').replace(/["'\s]/g, '');
  report('Size-adjusted fallback fonts for Inter and Faculty Glyphic', /font-family:InterFallback;[^}]*size-adjust/.test(css) && /font-family:FacultyGlyphicFallback;[^}]*size-adjust/.test(css) && css.includes('--font-sans:Inter,InterFallback') && css.includes('--font-display:FacultyGlyphic,FacultyGlyphicFallback'));
  report('Cross-document view transitions on, except with reduced motion', css.includes('@media(prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}'));

  /* ---------- Hero: no intro; the still cord from first paint at its final size ---------- */
  for (const [name, opts] of sizes) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'commit' });
    await page.waitForSelector('.hero__still', { state: 'attached' });
    const at = () => page.evaluate(() => {
      const s = document.querySelector('.hero__still'); const r = s.getBoundingClientRect();
      return { op: +getComputedStyle(s).opacity, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), intro: !!document.querySelector('[data-intro], .intro') };
    });
    const first = await at();
    await page.waitForLoadState('load');
    const loaded = await at();
    const same = ['x', 'y', 'w', 'h'].every((k) => first[k] === loaded[k]);
    report(`Hero at ${name}: no intro, the still cord visible from first paint at its final size`, !first.intro && first.op === 1 && first.w > 0 && same, `first ${first.w}×${first.h} at ${first.x},${first.y}, loaded ${loaded.w}×${loaded.h}`);

    // The live cord fades in over the still: the picture barely changes.
    await page.waitForTimeout(900);   // the copy's entrance is over
    const box = { x: 0, y: 0, width: opts.viewport.width, height: opts.viewport.height };
    const before = await page.screenshot({ clip: box });
    await page.keyboard.press('Shift');   // a key press lets the cord load (a pointer would push it)
    const live = await page.waitForSelector('[data-hero].is-live', { timeout: 15000 }).then(() => true, () => false);
    await page.waitForTimeout(700);   // the 0.6 s fade is over; the breeze already sways it a little (a jump scores 150+)
    const after = await page.screenshot({ clip: box });
    const diff = await meanDiff(before, after);
    report(`Hero at ${name}: the live cord swaps in without a visible jump`, live && diff.mean < 3 && diff.max < 90, `live ${live}, at 1/8 scale: mean change ${diff.mean.toFixed(2)}/255, largest ${diff.max}`);
    await ctx.close();
  }

  /* ---------- Text does not move when the web fonts arrive ---------- */
  for (const [name, opts] of sizes) {
    const boxes = async (block) => {
      const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
      if (block) await ctx.route(/\.woff2$/, (r) => r.abort());
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const out = await page.evaluate(() => ['#hero-title', '.hero__sub', '.about .t-statement', '.plugin__text'].map((s) => {
        const el = document.querySelector(s);
        const r = el.getBoundingClientRect();
        // The text's own width (its widest line), not the box it sits in.
        const range = document.createRange();
        range.selectNodeContents(el);
        const w = Math.max(...[...range.getClientRects()].map((q) => q.width));
        return { s, w, h: r.height, y: r.top + scrollY, web: document.fonts.check('16px Inter') };
      }));
      await ctx.close();
      return out;
    };
    const [fallback, web] = [await boxes(true), await boxes(false)];
    if (fallback[0].web || !web[0].web) { report(`Fonts at ${name}: test set-up (web fonts blocked, then loaded)`, false); continue; }
    const moves = fallback.map((f, i) => ({ s: f.s, dh: Math.abs(f.h - web[i].h), dy: Math.abs(f.y - web[i].y), dw: Math.abs(f.w - web[i].w) / web[i].w }));
    const worst = moves.filter((m) => m.dh > 2 || m.dy > 2 || m.dw > 0.04);
    report(`Fonts at ${name}: hero and About text keep their size and place when the web fonts swap in`, worst.length === 0, moves.map((m) => `${m.s} h±${m.dh.toFixed(0)} y±${m.dy.toFixed(0)} w±${(m.dw * 100).toFixed(1)}%`).join(', '));
  }

  /* ---------- Case study prerenders on hover; back restores the scroll ---------- */
  // Chrome will not prerender while DevTools (this test) is attached, so the
  // check reads the browser's own preload events: no attempt before the hover,
  // a prerender of the case study within a moment of it.
  {
    const ctx = await browser.newContext(DESK);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const seen = [];
    await cdp.send('Preload.enable');
    cdp.on('Preload.prerenderStatusUpdated', (e) => seen.push({ url: e.key.url, status: e.status, why: e.prerenderStatus || '', t: Date.now() }));
    await page.goto(`${base}/`, { waitUntil: 'load' });
    const link = page.locator('a.text-link[href="work/smile-dental/"]');
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const early = seen.length;
    const t = Date.now();
    await link.hover();
    await page.waitForTimeout(1200);
    const hit = seen.find((e) => e.url.endsWith('/work/smile-dental/') && e.t >= t);
    report('Hovering a case study link starts a prerender of it (none before the hover)', early === 0 && !!hit, hit ? `after ${hit.t - t} ms: ${hit.status} ${hit.why}` : `events: ${seen.length}`);
    await ctx.close();
  }
  for (const [name, opts] of sizes) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const target = name === '1440' ? 6200 : 5200;   // below "How it works"
    await page.evaluate((y) => window.scrollTo(0, y), target);
    await page.waitForTimeout(800);
    const left = await page.evaluate(() => Math.round(scrollY));
    await page.evaluate(() => document.querySelector('a[href="work/smile-dental/"]').click());
    await page.waitForURL('**/work/smile-dental/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);
    await page.goBack({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const back = await page.evaluate(() => ({ y: Math.round(scrollY), type: performance.getEntriesByType('navigation')[0]?.type }));
    report(`Back button at ${name} returns to the same place on the home page`, Math.abs(back.y - left) <= 4, `left at ${left}, back at ${back.y} (${back.type})`);
    await ctx.close();
  }

  /* ---------- Phones scroll natively ---------- */
  {
    const res = [];
    for (const [name, opts] of sizes) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      // The scripts load after the first paint: wait for the page script to have run.
      await page.waitForFunction(() => document.documentElement.classList.contains('motion'), null, { timeout: 8000 }).catch(() => {});
      res.push([name, await page.evaluate(() => document.documentElement.classList.contains('lenis'))]);
      await ctx.close();
    }
    report('Smooth scrolling only with a mouse or trackpad; phones scroll natively', res[0][1] === true && res[1][1] === false, res.map(([n, l]) => `${n}: ${l ? 'smooth' : 'native'}`).join(', '));
  }

  /* ---------- The How it works pin holds still (desktop, and a touch tablet) ---------- */
  for (const [name, opts] of [['1440', DESK], ['1180 touch', { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.querySelector('#how').scrollIntoView());
    await page.waitForTimeout(600);
    const range = await page.evaluate(() => window.__howPin?.());
    let tops = [];
    if (range) {
      for (let y = range[0] + 2; y < range[1] - 2; y += 37) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        tops.push(await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => res(Math.round(document.querySelector('[data-how-board]').getBoundingClientRect().top))))));
      }
    }
    const spread = tops.length ? Math.max(...tops) - Math.min(...tops) : -1;
    report(`How it works pin at ${name}: the board holds still while pinned`, !!range && tops.length > 10 && spread <= 1, range ? `${tops.length} steps, board top ${Math.min(...tops)}–${Math.max(...tops)} px` : 'no pin');
    await ctx.close();
  }

  /* ---------- No long tasks while scrolling ----------
     Desktop with the live cord; a phone at 4× slower CPU with the still cord;
     a phone with the live cord at normal CPU speed. (Here the cord's WebGL is
     drawn in software on the CPU, so slowing the CPU 4× as well would measure
     this test machine, not a phone's GPU.) */
  const runs = [
    ['1440, live cord', DESK, { cord: true, slow: 1 }],
    ['375, 4× slower CPU, still cord', PHONE, { cord: false, slow: 4 }],
    ['375, live cord', PHONE, { cord: true, slow: 1 }],
  ];
  for (const [name, opts, { cord, slow }] of runs) {
    const ctx = await browser.newContext(opts);
    if (!cord) await ctx.addInitScript(() => localStorage.setItem('va-cord-off', JSON.stringify({ fps: 0, at: Date.now() })));
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.keyboard.press('Shift');
    const live = cord ? await page.waitForSelector('[data-hero].is-live', { timeout: 15000 }).then(() => true, () => false) : false;
    await page.waitForTimeout(2500);
    if (slow > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
    await page.evaluate(() => { window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(`${Math.round(e.duration)} ms at ${Math.round(scrollY)}`))).observe({ type: 'longtask' }); });
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (opts.isMobile) {
      for (let y = 0; y <= end; y += 120) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(32); }
    } else {
      for (let y = 0; y <= end; y += 200) { await page.mouse.wheel(0, 200); await page.waitForTimeout(24); }
      await page.waitForTimeout(1200);
    }
    const long = await page.evaluate(() => window.__long);
    report(`Scrolling the whole home page (${name}): no long tasks over 50 ms`, long.length === 0 && live === cord, `${cord ? (live ? 'cord live, ' : 'cord did not go live, ') : ''}${long.length ? `long tasks ${long.join(', ')}` : 'none'}`);
    await ctx.close();
  }
}

// Compared at 1/8 scale, so the braid's fine texture (sharper live than in the
// still) does not count but any shift of the cord's shape does: the mean and
// the largest change per pixel (largest channel), out of 255.
async function meanDiff(a, b) {
  const { width, height } = await sharp(a).metadata();
  const small = (x) => sharp(x).resize(Math.round(width / 8), Math.round(height / 8), { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const [ra, rb] = await Promise.all([small(a), small(b)]);
  let sum = 0, max = 0;
  for (let i = 0; i < ra.length; i += 3) {
    const d = Math.max(Math.abs(ra[i] - rb[i]), Math.abs(ra[i + 1] - rb[i + 1]), Math.abs(ra[i + 2] - rb[i + 2]));
    sum += d;
    max = Math.max(max, d);
  }
  return { mean: sum / (ra.length / 3), max };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'http://localhost:4173'] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkSpeed({ browser, base, report });
  await browser.close();
  process.exitCode = failed ? 1 : 0;
}
