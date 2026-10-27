// The Riya panel (js/riya-panel.js, css/riya.css):
// - every "Chat with Riya now" link (home: hero, services, after How it works,
//   footer; case study: step 02, footer) opens it, "hi" gets a reply from the
//   live chat endpoint, and Esc closes it with focus back on the link;
// - blocked endpoint: the "Riya is taking a break" WhatsApp line;
// - one message per 2 s, 30 per visit (then the WhatsApp line, input off);
// - a confirmed booking draws the "Sent to the clinic" stamp;
// - phones: a bottom sheet about 88% tall; 320 to 1920 px with no sideways scroll;
// - reduced motion: no cord, a fade; the cursor over the links reads CHAT;
// - nothing of the panel loads before the page's load event; its JS and CSS load
//   side by side once the page is idle, before any click; its JS is under 8 KB gzipped;
// - a click shows the backdrop or cord within 100 ms and the panel is ready
//   (focus in it) within 900 ms, desktop and phone (first tap, no hover);
// - the chat service's name nowhere in the built HTML, JS or CSS;
// - Lighthouse, home, mobile: 95 or more (median of 3): checkLighthouse, run first.
// Screenshots: docs/screenshots/riya-panel/. Part of check-launch.mjs.
//   node scripts/check-riya.mjs [baseUrl]
import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const SHOTS = 'docs/screenshots/riya-panel';
const BREAK = 'Riya is taking a break';
const chrome = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });

// The live endpoint answers the site's own origins only: from a local server the
// request is forwarded from here (the reply still comes from the live endpoint).
async function forward(ctx, base) {
  if (!/localhost|127\.0\.0\.1/.test(base)) return;
  await ctx.route('https://chat.svayra.com/**', async (r) => {
    // Unreachable (no DNS, server down): the request fails as it would in the page, and the check reports it.
    const res = await r.fetch({ headers: { ...r.request().headers(), origin: 'https://svayra.com' } }).catch(() => null);
    if (!res) { await r.abort('failed'); return; }
    await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } });
  });
}
const stub = (ctx, reply) => ctx.route('https://chat.svayra.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ output: reply }) }));
const isOpen = (page) => page.waitForFunction(() => { const r = document.querySelector('.riya'); return r && !r.hidden && document.activeElement && r.contains(document.activeElement); }, null, { timeout: 8000 }).then(() => true, () => false);
const ready = (page) => page.waitForFunction(() => document.documentElement.classList.contains('motion') || !document.documentElement.classList.contains('js'), null, { timeout: 8000 }).catch(() => {});

async function sendAndWait(page, text) {
  const n = await page.locator('.riya__msg--riya').count();
  await page.fill('.riya__input', text);
  await page.press('.riya__input', 'Enter');
  await page.waitForFunction((n) => document.querySelectorAll('.riya__msg--riya').length > n, n, { timeout: 30000 });
  return (await page.locator('.riya__msg--riya').last().innerText()).trim();
}

// How long a click on a Riya link takes to answer, timed in the page from the
// click event: `seen` = the backdrop or cord first painted, `plugged` = the plug
// is in, `ready` = the panel is open with focus in it (the input with a mouse).
// A fresh page each time, the link clicked 2 s after load (desktop) or tapped
// with no hover first (phone). `preloaded`: the panel's files were fetched
// before the click; `together`: their two requests started together.
export async function timeRiya(browser, base, { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  await stub(ctx, 'Hello!');
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await ready(page);
  await page.waitForTimeout(2000);
  const link = page.locator('#services [data-riya]');
  await link.evaluate((a) => a.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  const files = () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /riya-panel\.js|riya\.css/.test(e.name)).map((e) => e.startTime));
  const fetched = (await files()).length;
  await page.evaluate(() => {
    const t = window.__riyaT = {};
    addEventListener('click', (e) => {
      if (!e.target.closest?.('[data-riya]') || t.click) return;
      t.click = e.timeStamp;
      const tick = (now) => {
        const r = document.querySelector('.riya'), b = r?.querySelector('.riya__backdrop');
        const at = performance.now() - t.click;
        if (!t.seen && r && !r.hidden && (+getComputedStyle(b).opacity > 0.02 || r.querySelector('.riya__cord')?.innerHTML)) t.seen = at;
        if (!t.plugged && r?.classList.contains('is-plugged')) t.plugged = at;
        if (!t.ready && r && !r.hidden && r.contains(document.activeElement)) t.ready = at;
        if (!t.ready && at < 8000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, true);
  });
  if (mobile) await link.tap(); else await link.click();
  await page.waitForFunction(() => window.__riyaT.ready || performance.now() - window.__riyaT.click > 8000, null, { timeout: 12000 });
  const t = await page.evaluate(() => window.__riyaT);
  const starts = await files();
  await ctx.close();
  return { seen: Math.round(t.seen), plugged: Math.round(t.plugged), ready: Math.round(t.ready), preloaded: fetched === 2, together: starts.length === 2 && Math.abs(starts[0] - starts[1]) < 50 };
}

export async function checkRiya({ base = 'http://localhost:4173', report }) {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chrome();

  // ---------- Every link: opens, "hi" gets a live reply, Esc closes, focus returns ----------
  for (const [path, w, h, mobile] of [['/', 1440, 900, false], ['/work/smile-dental/', 1440, 900, false], ['/', 375, 812, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    await forward(ctx, base);
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: 'load' });
    await ready(page);
    await page.waitForTimeout(800);
    // Requested before the page's load event finished (the HTML never names them).
    const before = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; return performance.getEntriesByType('resource').filter((e) => /riya-panel\.js|riya\.css/.test(e.name) && e.startTime < nav.loadEventEnd).length; });
    const count = await page.locator('[data-riya]').count();
    const results = [];
    for (let i = 0; i < count; i++) {
      const link = page.locator('[data-riya]').nth(i);
      await link.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const where = await link.evaluate((a) => a.closest('section, footer, li, .hero__riya')?.id || a.closest('footer') && 'footer' || a.parentElement.className);
      if (mobile) await link.tap(); else await link.click();
      const opened = await isOpen(page);
      let reply = '', esc = false, back = false, wide = 0;
      if (opened) {
        reply = await sendAndWait(page, 'hi').catch(() => '');
        wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (i === 1 && path === '/') await page.screenshot({ path: `${SHOTS}/panel-${w}.png` });
        await page.keyboard.press('Escape');
        esc = await page.waitForFunction(() => document.querySelector('.riya').hidden, null, { timeout: 3000 }).then(() => true, () => false);
        back = await link.evaluate((a) => document.activeElement === a);
      }
      const ok = opened && reply && !reply.includes(BREAK) && esc && back && wide <= 0;
      results.push({ where, opened, reply: reply.slice(0, 50), esc, focusBack: back, ok });
    }
    report(`Riya panel ${path} at ${w}${mobile ? ' (touch)' : ''}: each of the ${count} "Chat with Riya now" links opens it, "hi" gets a live reply, Esc closes it and focus returns to the link; nothing of it loads before the page's load event`,
      count >= 2 && results.every((r) => r.ok) && before === 0, JSON.stringify({ loadedWithPage: before, results }));
    await ctx.close();
  }

  // ---------- Blocked endpoint: the WhatsApp line ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route('https://chat.svayra.com/**', (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await ready(page);
    const link = page.locator('#services [data-riya]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await isOpen(page);
    const reply = await sendAndWait(page, 'hi').catch(() => '');
    const href = await page.locator('.riya__msg--riya a').last().getAttribute('href').catch(() => null);
    report('Riya panel: with the endpoint blocked, "Riya is taking a break. Message me on WhatsApp instead →" links to the free-check WhatsApp message', reply.startsWith(BREAK) && /wa\.me\/919653375679.*free%20report/.test(href || ''), JSON.stringify({ reply, href }));
    await ctx.close();
  }

  // ---------- Limits, the stamp, the chips ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(ctx, 'Aapki appointment kal 02:00 PM par confirm ho gayi hai.');
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await ready(page);
    await page.locator('#services [data-riya]').scrollIntoViewIfNeeded();
    await page.locator('#services [data-riya]').click();
    await isOpen(page);
    const chips = await page.locator('.riya__chip').allInnerTexts();
    await page.locator('.riya__chip').nth(2).click();
    await page.waitForSelector('.riya__msg--riya');
    const sentChip = await page.locator('.riya__msg--you').first().innerText();
    await page.waitForTimeout(900);
    const stamp = await page.locator('.riya__stamp').innerText().catch(() => '');
    // A second message within 2 s is not sent.
    await page.fill('.riya__input', 'second');
    await page.press('.riya__input', 'Enter');
    await page.waitForTimeout(300);
    const quick = await page.locator('.riya__msg--you').count();
    // 30 per visit: the 30th gets its reply, then the WhatsApp line, and the input goes off.
    await page.evaluate(() => sessionStorage.setItem('va-riya-count', '29'));
    await page.reload({ waitUntil: 'load' });
    await ready(page);
    await page.locator('#services [data-riya]').scrollIntoViewIfNeeded();
    await page.locator('#services [data-riya]').click();
    await isOpen(page);
    await sendAndWait(page, 'one more');
    await page.waitForTimeout(400);
    const end = await page.locator('.riya__msg--riya a').last().innerText().catch(() => '');
    const off = await page.locator('.riya__input').isDisabled();
    report('Riya panel: three chips (tapping one sends it); a confirmed booking draws "Sent to the clinic"; one message per 2 s; after 30 the WhatsApp line and the input goes off',
      chips.join('|') === 'Saturday checkup ka slot milega?|What are your timings?|Kal 2 baje appointment chahiye' && sentChip === 'Kal 2 baje appointment chahiye' && /sent to the clinic/i.test(stamp) && quick === 1 && /WhatsApp/.test(end) && off,
      JSON.stringify({ chips, sentChip, stamp, messagesAfterQuickSecond: quick, end, inputOff: off }));
    await ctx.close();
  }

  // ---------- Phones: a bottom sheet; 320 to 1920 with no sideways scroll ----------
  {
    const out = [];
    let ok = true;
    for (const [w, h, m] of [[320, 568, true], [375, 812, true], [768, 1024, true], [1024, 768, false], [1920, 1080, false]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m });
      await stub(ctx, 'Hello!');
      const page = await ctx.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      await ready(page);
      const link = page.locator('#services [data-riya]');
      await link.scrollIntoViewIfNeeded();
      if (m) await link.tap(); else await link.click();
      await isOpen(page);
      await page.waitForTimeout(700);
      const g = await page.evaluate(() => { const r = document.querySelector('.riya__panel').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top), sideways: document.documentElement.scrollWidth - innerWidth }; });
      const sheet = w < 600;
      const fits = sheet ? Math.abs(g.h / h - 0.88) < 0.03 && g.w === w && g.left === 0 : g.w === Math.min(400, w) && g.h === h && g.left === w - g.w;
      if (!fits || g.sideways > 0) ok = false;
      out.push(`${w}: ${g.w}×${g.h} at ${g.left},${g.top}${g.sideways > 0 ? ' SIDEWAYS' : ''}`);
      if (w === 375) await page.screenshot({ path: `${SHOTS}/panel-375-sheet.png` });
      await ctx.close();
    }
    report('Riya panel: a right-hand panel 400 px wide and full height on wide screens, a bottom sheet 88% tall on phones; no sideways scroll from 320 to 1920', ok, out.join('; '));
  }

  // ---------- Reduced motion: no cord, a fade; the cursor reads CHAT ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await stub(ctx, 'Hello!');
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const link = page.locator('#services [data-riya]');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForTimeout(80);
    const mid = await page.evaluate(() => ({ cord: document.querySelector('.riya__cord')?.innerHTML.length || 0, clip: document.querySelector('.riya__panel')?.style.clipPath || '' }));
    const opened = await isOpen(page);
    report('Riya panel with reduced motion: no cord and no mask, a short fade', opened && mid.cord === 0 && !mid.clip, JSON.stringify({ opened, ...mid }));
    await ctx.close();

    const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await c2.newPage();
    await p2.goto(base + '/', { waitUntil: 'load' });
    await ready(p2);
    const l2 = p2.locator('#services [data-riya]');
    await l2.scrollIntoViewIfNeeded();
    await l2.hover();
    await p2.waitForTimeout(500);
    const label = await p2.evaluate(() => ({ on: document.querySelector('[data-cursor-root]').classList.contains('is-label'), word: document.querySelector('[data-cursor-label]').textContent, plug: +getComputedStyle(document.querySelector('#services .riya-link__plug')).opacity, line: getComputedStyle(document.querySelector('#services .riya-link'), '::after').transform }));
    report('Riya links: the cursor reads CHAT; on hover a plug slides in after the words and a 2 px line draws under them', label.on && /chat/i.test(label.word) && label.plug > 0.9 && label.line !== 'matrix(0, 0, 0, 1, 0, 0)', JSON.stringify(label));
    await c2.close();
  }
  // ---------- Opening: seen within 100 ms, ready within 900 ms (median of 3) ----------
  for (const mobile of [false, true]) {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await timeRiya(browser, base, { mobile }));
    const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[1];
    report(`Riya panel opens at once ${mobile ? 'on a phone (first tap, no hover)' : 'on desktop'}: backdrop or cord within 100 ms of the click, ready within 900 ms (median of 3); its JS and CSS were fetched together before the click`,
      med('seen') < 100 && med('ready') < 900 && runs.every((r) => r.preloaded && r.together), JSON.stringify({ seen: med('seen'), ready: med('ready'), runs }));
  }
  await browser.close();

  // ---------- Built files: the chat service's name nowhere; the panel's JS budget ----------
  // (Stored encoded, so this public script does not name it either.)
  const name = new RegExp(Buffer.from('bjhu', 'base64').toString(), 'i');
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(html|js|mjs|css|json|webmanifest|xml|txt)$/.test(f)) files.push(p); });
  walk('public');
  const hits = files.filter((f) => name.test(readFileSync(f, 'utf8')));
  report(`The chat service is not named anywhere in the built site (${files.length} HTML, JS, CSS and text files)`, hits.length === 0, hits.join(', '));
  const js = readFileSync('public/js/riya-panel.js');
  const gz = gzipSync(js).length;
  report('The Riya panel\'s JS is under 8 KB as sent (gzip)', gz < 8192, `${(gz / 1024).toFixed(1)} KB gzipped, ${(js.length / 1024).toFixed(1)} KB as written`);
}


// Lighthouse, home, mobile: 95 or more (median of 3). check-launch runs it
// first, while the machine is idle: after the browser tests it scored lower
// for both the current and the earlier site (machine load, not the page).
export async function checkLighthouse({ base = 'http://localhost:4173', report }) {
  const scores = [];
  for (let i = 0; i < 3; i++) {
    const out = execFileSync('npx', ['--yes', 'lighthouse@12', `${base}/`, '--quiet', '--output=json', '--output-path=stdout', '--only-categories=performance', '--chrome-path=C:/Program Files/Google/Chrome/Application/chrome.exe', '--chrome-flags=--headless=new'], { maxBuffer: 64 * 1024 * 1024, shell: true }).toString();
    const r = JSON.parse(out);
    scores.push({ perf: Math.round(r.categories.performance.score * 100), tbt: Math.round(r.audits['total-blocking-time'].numericValue), lcp: +(r.audits['largest-contentful-paint'].numericValue / 1000).toFixed(1) });
  }
  const m = [...scores].sort((a, b) => a.perf - b.perf)[1];
  report('Lighthouse, home, mobile: performance 95 or more (median of 3)', m.perf >= 95, JSON.stringify({ median: m, runs: scores }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = 0;
  const report = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
  const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:4173';
  if (process.argv.includes('--time')) {
    // Timings only:  node scripts/check-riya.mjs https://svayra.com --time
    const browser = await chrome();
    for (const mobile of [false, true]) for (let i = 0; i < 3; i++) console.log(mobile ? 'phone  ' : 'desktop', JSON.stringify(await timeRiya(browser, base, { mobile })));
    await browser.close();
    process.exit(0);
  }
  if (!process.argv.includes('--no-lh')) await checkLighthouse({ base, report });
  await checkRiya({ base, report });
  process.exitCode = failed ? 1 : 0;
}
