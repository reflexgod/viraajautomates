// The hero cord can be taken and pulled: with a mouse (hover, press, drag, let go)
// and on a phone (long-press, drag), and a quick swipe on a phone still scrolls the page.
// "Moved" is measured on the picture: the share of the cord's area that changes while
// it is pulled, against the share that changes while it is left alone.
//   node scripts/check-cable.mjs      (needs npm run serve)
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

// Share of pixels (0..1) that differ noticeably between two screenshots of the same clip.
async function changed(a, b) {
  const [x, y] = await Promise.all([a, b].map((png) => sharp(png).removeAlpha().raw().toBuffer()));
  let n = 0;
  for (let i = 0; i < x.length; i += 3) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 60) n++;
  return n / (x.length / 3);
}

export async function checkCable({ browser, base = 'http://localhost:4173', report }) {
  // ---------- Mouse, 1440 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.mouse.move(700, 700);
    await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4500);   // the cord drops in, then settles
    const cls = () => page.getAttribute('[data-hero]', 'class');
    // Every place the cord answers to; take one mid-cord (near its anchors it hardly moves,
    // and the pointer's push is what used to keep a press from taking hold).
    const spots = [];
    for (let y = 200; y < 840; y += 32) for (let x = 760; x < 1380; x += 32) {
      await page.mouse.move(x, y);
      if (/is-over-cable/.test(await cls())) spots.push({ x, y });
    }
    const spot = spots.sort((p, q) => Math.abs(p.y - 470) - Math.abs(q.y - 470))[0] || null;
    await page.mouse.move(700, 880);
    await page.waitForTimeout(1200);
    let res = { spot };
    if (spot) {
      const clip = { x: 560, y: 100, width: 860, height: 780 };
      await page.mouse.move(spot.x, spot.y);
      await page.waitForTimeout(400);
      const grab = await page.getAttribute('[data-hero]', 'data-cursor');
      const a = await page.screenshot({ clip });
      await page.waitForTimeout(400);
      const idle = await changed(a, await page.screenshot({ clip }));   // what breeze and push do alone
      await page.mouse.down();
      await page.waitForTimeout(80);
      const held = /is-holding/.test(await cls()), pull = await page.getAttribute('[data-hero]', 'data-cursor');
      await page.mouse.move(spot.x - 200, spot.y + 120, { steps: 14 });
      await page.waitForTimeout(250);
      const pulled = await changed(a, await page.screenshot({ clip }));
      await page.mouse.up();
      await page.mouse.move(700, 880);
      await page.waitForTimeout(2200);
      const back = await changed(a, await page.screenshot({ clip }));
      res = { spot, grab, held, pull, idle: +idle.toFixed(3), pulled: +pulled.toFixed(3), back: +back.toFixed(3), released: !/is-holding/.test(await cls()) };
      res.ok = grab === 'Grab' && held && pull === 'Pull' && pulled > idle * 3 && pulled > 0.03 && back < pulled * 0.75 && res.released;
    }
    report('Hero cord, mouse: hover shows GRAB, a press takes hold (PULL), dragging moves it, letting go swings it back', !!res.ok, JSON.stringify(res));
    await ctx.close();
  }

  // ---------- The live cord is not switched off for ordinary phones ----------
  // A phone reporting 4 GB, a browser holding an old "averaged … fps" flag (no date), or
  // a flag older than 7 days: the cord still goes live. A fresh flag keeps the still image.
  {
    const cases = [
      ['4 GB phone', { mem: 4 }, true],
      ['old flag without a date', { flag: 'averaged 18 fps' }, true],
      ['flag from 8 days ago', { flag: JSON.stringify({ fps: 18, at: Date.now() - 8 * 864e5 }) }, true],
      ['flag from today', { flag: JSON.stringify({ fps: 18, at: Date.now() }) }, false],
    ];
    const out = [];
    for (const [name, c, wantLive] of cases) {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
      await ctx.addInitScript(({ mem, flag }) => {
        try { sessionStorage.setItem('va-intro', '1'); } catch (e) {}
        if (mem) Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => mem });
        if (flag && !sessionStorage.getItem('flag-set')) { localStorage.setItem('va-cord-off', flag); sessionStorage.setItem('flag-set', '1'); }
      }, c);
      const page = await ctx.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.touchscreen.tap(20, 300);
      const live = await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 12000 }).then(() => true).catch(() => false);
      out.push([live === wantLive, `${name}: ${live ? 'live' : 'still'}`]);
      await ctx.close();
    }
    report('Hero cord: live on a 4 GB phone and after an old or expired low-fps flag; a fresh flag keeps the still image', out.every((r) => r[0]), out.map((r) => r[1]).join(', '));
  }

  // ---------- Touch, 375: long-press takes hold; a quick swipe scrolls ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await page.goto(base + '/', { waitUntil: 'load' });
    await touch('touchStart', 20, 300); await touch('touchEnd');   // a first touch starts the live cord
    await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4500);
    // The cord is cream on plum: the first bright pixel along a row right of the copy.
    const shot = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const [top, bottom] = await page.evaluate(() => [Math.ceil(document.querySelector('.nav, [data-nav]')?.getBoundingClientRect().bottom || 80) + 10, Math.floor(document.querySelector('.hero__copy').getBoundingClientRect().top + parseFloat(getComputedStyle(document.querySelector('.hero__copy')).paddingTop)) - 20]);
    let spot = null;
    for (let y = top; y < bottom && !spot; y += 10) for (let x = 120; x < 372 && !spot; x += 2) {
      const i = (y * shot.info.width + x) * 3;
      if (shot.data[i] > 170 && shot.data[i + 1] > 150 && shot.data[i + 2] > 120) spot = { x: x + 4, y };
    }
    let res = { spot, top, bottom };
    if (spot) {
      const clip = { x: 0, y: 80, width: 375, height: 600 };
      const a = await page.screenshot({ clip });
      await touch('touchStart', spot.x, spot.y);
      await page.waitForTimeout(400);                                  // past the 260 ms long-press
      const held = /is-holding/.test(await page.getAttribute('[data-hero]', 'class'));
      for (let k = 1; k <= 12; k++) { await touch('touchMove', spot.x - k * 12, spot.y + k * 8); await page.waitForTimeout(16); }
      await page.waitForTimeout(200);
      const pulled = await changed(a, await page.screenshot({ clip }));
      const scrolledWhileHeld = await page.evaluate(() => scrollY);
      await touch('touchEnd');
      await page.waitForTimeout(300);
      // A quick swipe (no hold) on the same place scrolls the page.
      await touch('touchStart', spot.x, 600);
      for (let k = 1; k <= 8; k++) { await touch('touchMove', spot.x, 600 - k * 30); await page.waitForTimeout(16); }
      await touch('touchEnd');
      await page.waitForTimeout(800);
      const swiped = await page.evaluate(() => scrollY);
      res = { spot, held, pulled: +pulled.toFixed(3), scrolledWhileHeld, swiped };
      res.ok = held && pulled > 0.03 && scrolledWhileHeld === 0 && swiped > 50;
    }
    report('Hero cord, touch: a 260 ms long-press takes hold and drags it (no page scroll); a quick swipe still scrolls the page', !!res.ok, JSON.stringify(res));
    await ctx.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  const results = [];
  const report = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkCable({ browser, base: process.argv[2] || undefined, report });
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
}
