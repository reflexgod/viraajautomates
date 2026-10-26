// The hero cord is plugged in, and the button says so only when it is:
// - the plug's tip within 4 px of the centre of the button's socket, for the
//   still image and the live cord, right after load, at 3 s (live by then on
//   touch screens), after 5 s idle, after scrolling down and back to the top,
//   and after the iOS URL bar collapses (a taller viewport); at 1920, 1720,
//   1440, 1280, 1024 and 768 wide and on the iPhone 13 (390), iPhone SE (3rd
//   gen) (375) and iPhone SE (320) presets, touch on, in WebKit and Chromium;
// - exactly one socket shows, inside the screen and the hero, also once the
//   button is hovered or tapped;
// - the button's "plugged" state (data-plugged) agrees with where the tip is,
//   and its text is always "Get my free report": at rest, while the plug is
//   dragged out, after it is let go far away (it settles back in), and back
//   from WhatsApp;
// - the hero's bottom strip, and "Scroll ↓" in it, sit inside the screen from
//   1024 to 1920 (at 100% and 125% display scaling).
// Screenshots at 375 and 390 go to docs/screenshots/round13/. Part of check-launch.mjs.
//   node scripts/check-plug.mjs [baseUrl]
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium, webkit, devices } from 'playwright-core';
import { FRAMES } from '../public/js/cable/layout.js';

const SHOTS = 'docs/screenshots/round13';
const TOL = 4;
const CTA = 'Get my free report';
const F = { wide: FRAMES.wide, tall: FRAMES.tall };

// In the page: where the plug's tip is (still and live cord) against the socket's
// centre, the button's state and text, and the socket-like circles that show.
function measure(F) {
  const hero = document.querySelector('[data-hero]');
  const root = hero.querySelector('[data-plugin-3d]');
  const k = hero.querySelector('.plugin__socket').getBoundingClientRect();
  const sock = { x: k.left + k.width / 2, y: k.top + k.height / 2 };
  const f = F[matchMedia('(min-width: 768px)').matches ? 'wide' : 'tall'];
  const img = hero.querySelector('.hero__still');
  const r = img.getBoundingClientRect();
  const still = { x: r.left + ((f.socket[0] - f.still.x0) / (f.still.x1 - f.still.x0)) * r.width, y: r.top + ((f.socket[1] - f.still.y0) / (f.still.y1 - f.still.y0)) * r.height };
  const live = hero.classList.contains('is-live') && !!hero.cordTip;
  const d = (p) => +Math.hypot(p.x - sock.x, p.y - sock.y).toFixed(1);
  const h = hero.getBoundingClientRect();
  const shown = [...hero.querySelectorAll('.plugin__socket, .plugin__plug')].filter((el) => {
    const cs = getComputedStyle(el), b = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && b.width > 0;
  }).map((el) => el.getBoundingClientRect());
  const inside = shown.every((b) => b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight && b.left >= h.left && b.right <= h.right && b.bottom <= h.bottom);
  const tip = live ? d(hero.cordTip()) : d(still);
  return {
    live, still: d(still), cord: live ? d(hero.cordTip()) : null, tip,
    state: root.dataset.plugged, text: root.querySelector('.plugin__btn').innerText.trim(),
    sockets: shown.length, inside,
  };
}
// The state agrees with the tip: plugged exactly when the visible plug is in the socket.
const agrees = (m) => (m.state === 'true') === (m.tip <= TOL);
const atRest = (m) => m.still <= TOL && (m.cord === null || m.cord <= TOL) && m.state === 'true' && m.text === CTA;
const brief = (m) => `${m.live ? 'live' : 'still'} tip ${m.tip}${m.live ? ` (still ${m.still})` : ''} ${m.state === 'true' ? 'plugged' : 'unplugged'} "${m.text}" sockets ${m.sockets}${m.inside ? '' : ' OUTSIDE'}`;

const launchers = {
  WebKit: () => webkit.launch(),
  Chromium: (opts = {}) => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...opts }),
};

export async function checkPlug({ base = 'http://localhost:4173', report }) {
  mkdirSync(SHOTS, { recursive: true });
  const cases = [
    ['1920', { viewport: { width: 1920, height: 1080 } }],
    ['1720', { viewport: { width: 1720, height: 960 } }],
    ['1440', { viewport: { width: 1440, height: 900 } }],
    ['1280', { viewport: { width: 1280, height: 720 } }],
    ['1024', { viewport: { width: 1024, height: 768 } }],
    ['768', { viewport: { width: 768, height: 1024 } }],
    ['iPhone 13 (390)', devices['iPhone 13']],
    ['iPhone SE (3rd gen) (375)', devices['iPhone SE (3rd gen)']],
    ['iPhone SE (320)', devices['iPhone SE']],
  ];

  // ---------- At rest, at every width, in both engines ----------
  for (const engine of ['WebKit', 'Chromium']) {
    const browser = await launchers[engine]();
    for (const [name, dev] of cases) {
      const touch = !!dev.hasTouch;
      const w = dev.viewport.width;
      const ctx = await browser.newContext(dev);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}/`, { waitUntil: 'load' });
      const steps = {};
      steps.load = await page.evaluate(measure, F);
      // A mouse wakes the cord on a laptop (in a corner, away from the cord); a phone gets nothing.
      if (!touch) await page.mouse.move(8, dev.viewport.height - 8);
      await page.waitForTimeout(3000);
      steps.at3s = await page.evaluate(measure, F);
      if (engine === 'WebKit' && (w === 375 || w === 390)) await page.screenshot({ path: `${SHOTS}/hero-${w}-${steps.at3s.live ? 'live' : 'still'}.png` });
      await page.waitForTimeout(2000);
      steps.idle5s = await page.evaluate(measure, F);
      await page.evaluate(() => scrollTo(0, 700));
      await page.waitForTimeout(700);
      steps.scrolledDown = await page.evaluate(measure, F);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(900);
      steps.scrolled = await page.evaluate(measure, F);
      // The URL bar collapsing: the visual viewport grows by 80 px.
      await page.setViewportSize({ width: w, height: dev.viewport.height + 80 });
      await page.waitForTimeout(700);
      steps.urlBar = await page.evaluate(measure, F);
      await page.setViewportSize(dev.viewport);
      await page.waitForTimeout(500);
      // Hover (or a first tap) on the button: one socket, the text unchanged.
      const btn = page.locator('.hero .plugin__btn');
      if (touch) await btn.tap(); else await btn.hover();
      await page.waitForTimeout(800);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(500);
      steps.opened = await page.evaluate(measure, F);
      if (engine === 'WebKit' && (w === 375 || w === 390)) await page.screenshot({ path: `${SHOTS}/hero-${w}-tapped.png` });

      const rest = ['load', 'at3s', 'idle5s', 'scrolled', 'urlBar'].every((k) => atRest(steps[k]));
      // (Scrolled down, the hero is off screen and its cord stops drawing.)
      const agree = Object.entries(steps).every(([k, m]) => k === 'scrolledDown' || agrees(m));
      const one = Object.entries(steps).every(([k, m]) => k === 'scrolledDown' || (m.sockets === 1 && m.inside));
      const texts = Object.values(steps).every((m) => m.text === CTA);
      const live = !touch || steps.at3s.live;
      report(`Hero plug in its socket, ${engine} ${name}${touch ? ' (touch)' : ''}: tip within ${TOL} px (still and live) at load, 3 s, 5 s idle, after a scroll and the URL bar; "plugged" agrees with the tip; one socket on screen; text "${CTA}"${touch ? '; live by 3 s' : ''}`,
        rest && agree && one && texts && live && errors.length === 0,
        JSON.stringify({ ...Object.fromEntries(Object.entries(steps).map(([k, m]) => [k, brief(m)])), errors }));
      await ctx.close();
    }
    await browser.close();
  }

  // ---------- Drag the plug out and let go far away; back from WhatsApp ----------
  const browser = await launchers.Chromium();
  const press = async (page, kind, cdp, type, x, y) => {
    if (kind === 'mouse') {
      if (type === 'down') { await page.mouse.move(x, y); await page.mouse.down(); }
      else if (type === 'move') await page.mouse.move(x, y);
      else await page.mouse.up();
    } else {
      const t = { down: 'touchStart', move: 'touchMove', up: 'touchEnd' }[type];
      await cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: type === 'up' ? [] : [{ x, y }] });
    }
  };
  for (const [name, opts, kind] of [['1440, mouse', { viewport: { width: 1440, height: 900 } }, 'mouse'], ['390, touch', devices['iPhone 13'], 'touch']]) {
    const ctx = await browser.newContext(opts);
    await ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }));
    const page = await ctx.newPage();
    const cdp = kind === 'touch' ? await ctx.newCDPSession(page) : null;
    await page.goto(`${base}/`, { waitUntil: 'load' });
    if (kind === 'mouse') await page.mouse.move(8, 892);
    await page.waitForFunction(() => document.querySelector('[data-hero]').classList.contains('is-live'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const before = await page.evaluate(measure, F);
    const at = await page.evaluate(() => document.querySelector('[data-hero]').cordPlug?.());
    const res = { before: brief(before) };
    let ok = !!at && atRest(before);
    if (at) {
      await press(page, kind, cdp, 'down', at.x, at.y);
      for (let k = 1; k <= 12; k++) { await press(page, kind, cdp, 'move', at.x - 20 * k, at.y + 25 * k); await page.waitForTimeout(16); }
      await page.waitForTimeout(300);
      const held = await page.evaluate(measure, F);
      await press(page, kind, cdp, 'up');
      await page.waitForTimeout(120);
      const released = await page.evaluate(measure, F);
      await page.waitForTimeout(1800);
      const settled = await page.evaluate(measure, F);
      Object.assign(res, { held: brief(held), released: brief(released), settled: brief(settled) });
      ok = ok && held.tip > TOL && held.state === 'false' && agrees(held) && agrees(released) && atRest(settled) && [held, released, settled].every((m) => m.text === CTA);
    }
    report(`Hero plug, ${name}: dragged out it shows unplugged, let go far away it settles back into the socket and shows plugged; the text stays "${CTA}"`, ok, JSON.stringify(res));

    // Click (or two taps), WhatsApp, back: the text is unchanged, the state agrees with the plug.
    const b = await page.locator('.hero .plugin__btn').boundingBox();
    if (kind === 'mouse') { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up(); }
    else { await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(700); const nb = await page.locator('.hero .plugin__btn').boundingBox(); await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2); }
    const went = await page.waitForURL(/wa\.me/, { timeout: 3000 }).then(() => true, () => false);
    await page.goBack();
    // Back where it was (the page restores the scroll): the state agrees with the plug.
    await page.waitForFunction(() => document.documentElement.classList.contains('motion'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const back = await page.evaluate(measure, F);
    // Then at the top, at rest: plugged in again.
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(2500);
    const top = await page.evaluate(measure, F);
    report(`Hero button, ${name}: back from WhatsApp it still reads "${CTA}" and "plugged" agrees with where the plug is; at the top it is plugged in`, went && back.text === CTA && agrees(back) && back.sockets === 1 && atRest(top), JSON.stringify({ went, back: brief(back), top: brief(top) }));
    await ctx.close();
  }
  await browser.close();

  // ---------- The bottom strip: inside the screen, nothing clipped, 1024 to 1920 ----------
  const sb = await launchers.Chromium({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const out = [];
  let stripOk = true;
  for (const [w, h] of [[1024, 768], [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1720, 960], [1920, 1080]]) {
    for (const dsf of [1, 1.25]) {
      const page = await sb.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
      await page.goto(`${base}/`, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const strip = document.querySelector('.hero__strip');
        const parts = [strip, ...strip.querySelectorAll('.hero__index > span, .hero__scroll')];
        const vw = document.documentElement.clientWidth;
        const bad = parts.filter((el) => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > vw || r.top < 0 || r.bottom > innerHeight || el.scrollWidth > el.clientWidth + 1; }).map((el) => el.className || el.textContent.trim());
        const s = document.querySelector('.hero__scroll').getBoundingClientRect();
        return { bad, scroll: [Math.round(s.left), Math.round(s.right)], vw, text: document.querySelector('.hero__scroll').innerText.trim() };
      });
      if (m.bad.length || !/^SCROLL/i.test(m.text)) { stripOk = false; out.push(`${w}@${dsf}: ${JSON.stringify(m)}`); }
      await page.close();
    }
  }
  report('Hero bottom strip and "Scroll ↓": inside the screen, nothing clipped, 1024 to 1920 wide at 100% and 125%', stripOk, out.join('; '));
  await sb.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  await checkPlug({ base: process.argv[2] || 'http://localhost:4173', report });
  process.exitCode = failed ? 1 : 0;
}
