// Fidgeting with the hero cord, and the first touch or scroll on a phone:
// - Phones (iPhone 13 preset, WebKit and Chromium): the live cord starts on the
//   first scroll, and on the first touch, without holding the page up: no task
//   longer than 100 ms in the 2 s after it (measured as gaps in a MessageChannel
//   ping-pong, which works in both engines; Chromium's long-task entries too).
//   Back at the top the plug is in its socket.
// - Desktop (Chromium, 1440 and 1920, mouse): GRAB over the plug and over the cord.
// - Unplug and plug back (Chromium 1440 with a mouse; Chromium iPhone 13 with
//   real touch; WebKit iPhone 13 with touch pointer events, as Playwright
//   cannot drive a touch drag in WebKit):
//   pulled 300 px away the plug's tip is 200+ px from the socket and the button
//   shows unplugged; let go within 40 px of the socket it is back in within 1 s;
//   let go far away it stays out at first, then is back in within 5 s; the page
//   never scrolls during a touch drag; no click reaches the button and WhatsApp
//   never opens from a drag; the button reads "Get my free report" throughout.
// Part of check-launch.mjs.   node scripts/check-fidget.mjs [baseUrl]
import { pathToFileURL } from 'node:url';
import { chromium, webkit, devices } from 'playwright-core';

const CTA = 'Get my free report';
const chrome = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// In the page: the plug's tip against the socket's centre, the state, the text.
function state() {
  const hero = document.querySelector('[data-hero]');
  const k = hero.querySelector('.plugin__socket').getBoundingClientRect();
  const t = hero.cordTip?.();
  return {
    live: hero.classList.contains('is-live') && !!t,
    gap: t ? +Math.hypot(t.x - (k.left + k.width / 2), t.y - (k.top + k.height / 2)).toFixed(1) : null,
    plugged: hero.querySelector('[data-plugin-3d]').dataset.plugged,
    text: hero.querySelector('.plugin__btn').innerText.trim(),
    y: scrollY,
  };
}
const waitLive = (page, ms = 15000) => page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: ms }).then(() => true, () => false);

export async function checkFidget({ base = 'http://localhost:4173', report }) {
  // ---------- Phones: the first scroll and the first touch stay smooth ----------
  for (const [engine, launch] of [['WebKit', () => webkit.launch()], ['Chromium', chrome]]) {
    const browser = await launch();
    for (const trigger of ['scroll', 'touch']) {
      const ctx = await browser.newContext(devices['iPhone 13']);
      const page = await ctx.newPage();
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForTimeout(3000);   // the page is idle; the cord's set-up that can't be split runs now
      const before = await page.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-live'));
      await page.evaluate(() => {
        window.__gaps = []; window.__long = [];
        const ch = new MessageChannel(); let last = performance.now(); window.__on = true;
        ch.port1.onmessage = () => { const t = performance.now(); if (t - last > 16) window.__gaps.push(Math.round(t - last)); last = t; if (window.__on) ch.port2.postMessage(0); };
        ch.port2.postMessage(0);
        try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { /* WebKit: no long-task entries */ }
      });
      if (trigger === 'scroll') await page.evaluate(() => scrollBy(0, 300));
      else await page.touchscreen.tap(30, 300);
      await page.waitForTimeout(2000);
      const m = await page.evaluate(() => { window.__on = false; return { gap: Math.max(0, ...window.__gaps), long: Math.max(0, ...window.__long) }; });
      const live = await waitLive(page, 4000);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(1200);
      const s = await page.evaluate(state);
      report(`First ${trigger} on a phone (${engine}, iPhone 13): the live cord starts${before ? ' (it was not waiting!)' : ''}, no task over 100 ms in the next 2 s, plug in its socket after the swap`,
        !before && live && m.gap <= 100 && m.long <= 100 && s.gap !== null && s.gap <= 4 && s.plugged === 'true',
        JSON.stringify({ liveBefore: before, live, longestGapMs: m.gap, longestLongTaskMs: m.long, after: s }));
      await ctx.close();
    }
    await browser.close();
  }

  // ---------- Desktop: GRAB over the plug and over the cord ----------
  {
    const browser = await chrome();
    for (const [w, h] of [[1920, 1080], [1440, 900]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.mouse.move(w * 0.7, h * 0.5);
      const live = await waitLive(page);
      await page.waitForTimeout(1200);
      const at = await page.evaluate(() => document.querySelector('[data-hero]').cordPlug());
      const cursor = () => page.evaluate(() => document.querySelector('[data-hero]').dataset.cursor || null);
      await page.mouse.move(at.x - 20, at.y);
      await page.waitForTimeout(120);
      const onPlug = await cursor();
      let onCord = null;
      for (let y = Math.round(h * 0.25); y < h * 0.85 && !onCord; y += 24) {
        for (let x = Math.round(w * 0.55); x < w - 40 && !onCord; x += 24) { await page.mouse.move(x, y); if (await cursor() === 'Grab') onCord = { x, y }; }
      }
      report(`Hero cord at ${w} (mouse): live, GRAB over the plug and over the cord`, live && onPlug === 'Grab' && !!onCord, JSON.stringify({ live, onPlug, onCord }));
      await page.close();
    }
    await browser.close();
  }

  // ---------- Unplug, fidget, plug back ----------
  const runs = [
    ['Chromium 1440, mouse', chrome, { viewport: { width: 1440, height: 900 } }, 'mouse', ''],
    ['Chromium iPhone 13, touch', chrome, devices['iPhone 13'], 'cdp', ''],
    // Headless WebKit draws WebGL in software (~5 fps): a forced tier keeps the live cord up.
    ['WebKit iPhone 13, touch', () => webkit.launch(), devices['iPhone 13'], 'synthetic', '?tier=low'],
  ];
  for (const [name, launch, dev, kind, query] of runs) {
    const browser = await launch();
    const ctx = await browser.newContext(dev);
    let whatsapp = 0;
    await ctx.route('https://wa.me/**', (r) => { whatsapp++; r.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }); });
    const page = await ctx.newPage();
    const cdp = kind === 'cdp' ? await ctx.newCDPSession(page) : null;
    await page.goto(`${base}/${query}`, { waitUntil: 'load' });
    await page.evaluate(() => { window.__clicks = 0; document.querySelector('.hero .plugin__btn').addEventListener('click', () => { window.__clicks++; }, true); });
    // Wake the cord: a mouse over the hero, or a phone's first scroll.
    if (kind === 'mouse') await page.mouse.move(1000, 600);
    else if (kind === 'cdp') { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 30, y: 300 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await page.evaluate(() => scrollBy(0, 40)); await page.waitForTimeout(300); await page.evaluate(() => scrollTo(0, 0)); }
    const live = await waitLive(page);
    await page.waitForTimeout(1500);

    const drive = {
      async down(x, y) {
        if (kind === 'mouse') { await page.mouse.move(x, y); await page.mouse.down(); }
        else if (kind === 'cdp') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        else await page.evaluate(({ x, y }) => { document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, clientX: x, clientY: y })); }, { x, y });
      },
      async move(x, y) {
        if (kind === 'mouse') await page.mouse.move(x, y);
        else if (kind === 'cdp') await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        else await page.evaluate(({ x, y }) => { document.querySelector('[data-hero]').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y })); }, { x, y });
      },
      async up(x, y) {
        if (kind === 'mouse') await page.mouse.up();
        else if (kind === 'cdp') await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.evaluate(({ x, y }) => { document.querySelector('[data-hero]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y })); }, { x, y });
      },
    };
    const glide = async (a, b, steps = 14) => { for (let i = 1; i <= steps; i++) { await drive.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps); await page.waitForTimeout(16); } };
    const poll = async (ms, ok) => { const t0 = Date.now(); let s; do { s = await page.evaluate(state); if (ok(s)) return { s, ms: Date.now() - t0 }; await page.waitForTimeout(80); } while (Date.now() - t0 < ms); return { s, ms: null }; };
    // 300 px away: down and to the left on a laptop, up and to the left on a phone (the plug sits low there).
    const away = kind === 'mouse' ? { x: -180, y: 240 } : { x: -180, y: -240 };
    const res = { live };
    let ok = live;
    if (live) {
      const y0 = await page.evaluate(() => scrollY);
      // 1. Pulled out 300 px.
      let at = await page.evaluate(() => document.querySelector('[data-hero]').cordPlug());
      const far = { x: at.x + away.x, y: at.y + away.y };
      await drive.down(at.x, at.y);
      await glide(at, far);
      await page.waitForTimeout(300);
      res.pulled = await page.evaluate(state);
      // 2. Back near the socket and let go.
      await glide(far, at);
      await page.waitForTimeout(250);
      res.nearBeforeRelease = await page.evaluate(state);
      await drive.up(at.x, at.y);
      const near = await poll(1000, (s) => s.gap <= 4 && s.plugged === 'true');
      res.nearBack = { ...near.s, inMs: near.ms };
      await page.waitForTimeout(600);
      // 3. Pulled out again and let go far away (over the button on a laptop, so a click would show).
      at = await page.evaluate(() => document.querySelector('[data-hero]').cordPlug());
      const drop = kind === 'mouse' ? await page.evaluate(() => { const r = document.querySelector('.hero .plugin__btn').getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2 }; }) : { x: at.x + away.x, y: at.y + away.y };
      await drive.down(at.x, at.y);
      await glide(at, drop);
      await page.waitForTimeout(200);
      const t0 = Date.now();
      await drive.up(drop.x, drop.y);
      await page.waitForTimeout(1200);
      res.farAfter1s = await page.evaluate(state);
      const back = await poll(5000 - (Date.now() - t0), (s) => s.gap <= 4 && s.plugged === 'true');
      res.farBack = { ...back.s, inMs: back.ms === null ? null : Date.now() - t0 };
      res.clicks = await page.evaluate(() => window.__clicks);
      res.whatsapp = whatsapp;
      res.scrolled = (await page.evaluate(() => scrollY)) - y0;
      const all = [res.pulled, res.nearBeforeRelease, res.nearBack, res.farAfter1s, res.farBack];
      ok = res.pulled.gap >= 200 && res.pulled.plugged === 'false'
        && res.nearBeforeRelease.gap <= 40 && near.ms !== null
        && res.farAfter1s.gap > 60 && res.farAfter1s.plugged === 'false' && back.ms !== null
        && res.clicks === 0 && whatsapp === 0 && res.scrolled === 0 && all.every((s) => s.text === CTA);
    }
    report(`Hero plug, ${name}: pulled 300 px away (tip 200+ px out, unplugged); let go within 40 px, back in within 1 s; let go far away, stays out, then back in within 5 s; no scroll, no click on the button, text "${CTA}"`, ok, JSON.stringify(res));
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkFidget({ base: process.argv[2] || 'http://localhost:4173', report });
  process.exitCode = failed ? 1 : 0;
}
