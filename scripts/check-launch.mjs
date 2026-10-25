// Pre-launch checks (brief section K). Needs the preview server (npm run serve).
//   node scripts/check-launch.mjs
// Prints PASS / FAIL per check.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { checkScroll } from './check-scroll.mjs';
import { checkHow } from './check-how.mjs';

const BASE = 'http://localhost:4173';
const results = [];
const report = (name, ok, detail = '') => { results.push([name, ok, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// ---------- Files ----------
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('vendor')) walk(p); } else if (/\.(html|css|js|txt|xml|json)$/.test(f) || f === 'CNAME') files.push(p); } })('public');
const banned = /photo coming|placeholder|todo|lorem/i;
// The input's own placeholder attribute and the ::placeholder rule are not placeholder content.
const hits = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => banned.test(l.replace(/\splaceholder="[^"]*"|::placeholder/g, ''))));
report('No "Photo coming", "placeholder", "TODO", "lorem" in the site files', hits.length === 0, hits.map(([f, n]) => `${f}:${n}`).join(' '));
const html = files.filter((f) => f.endsWith('.html'));
report('No noindex anywhere', !html.some((f) => /noindex/i.test(readFileSync(f, 'utf8'))));
const robots = readFileSync('public/robots.txt', 'utf8');
report('robots.txt allows all and lists the sitemap', /User-agent: \*/i.test(robots) && !/Disallow: \/\s*$/m.test(robots) && /Sitemap: https:\/\/viraajautomates\.tech\/sitemap\.xml/.test(robots), robots.replace(/\n/g, ' | '));
const sitemap = readFileSync('public/sitemap.xml', 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
report('sitemap.xml uses https://viraajautomates.tech', locs.length > 0 && locs.every((u) => u.startsWith('https://viraajautomates.tech/')), locs.join(' '));
const index = readFileSync('public/index.html', 'utf8');
const urls = [...index.matchAll(/(?:rel="canonical" href|property="og:(?:url|image)" content|name="twitter:image" content)="([^"]+)"/g)].map((m) => m[1]);
report('Canonical and OG URLs use https://viraajautomates.tech', urls.length >= 3 && urls.every((u) => u.startsWith('https://viraajautomates.tech/')), urls.join(' '));
report('CNAME contains viraajautomates.tech', readFileSync('public/CNAME', 'utf8').trim() === 'viraajautomates.tech');
report('sitemap.xml lists the case study', locs.includes('https://viraajautomates.tech/work/smile-dental/'));
const caseHtml = readFileSync('public/work/smile-dental/index.html', 'utf8');
const caseMeta = ['<title>', 'name="description"', 'rel="canonical" href="https://viraajautomates.tech/work/smile-dental/"', 'property="og:url" content="https://viraajautomates.tech/work/smile-dental/"', 'property="og:title"', 'property="og:image"'];
report('Case study has its own title, description, canonical and OG tags', caseMeta.every((m) => caseHtml.includes(m)), caseMeta.filter((m) => !caseHtml.includes(m)).join(' '));
// Never reveal the method or the stack, anywhere a visitor can load.
const siteText = files.map((f) => [f, readFileSync(f, 'utf8')]);
// The words are stored encoded, so this public script doesn't name them either.
const method = new RegExp(Buffer.from('bjhufGdlbWluaXxvcGVuYWl8XGJWUFNcYnxwYWdlc3BlZWR8Z29vZ2xlXC5jb21cL3NlYXJjaHx2aWV3LXNvdXJjZXxsaWdodGhvdXNl', 'base64').toString(), 'i');
const methodHits = siteText.filter(([, t]) => method.test(t)).map(([f, t]) => `${f}: ${t.match(method)[0]}`);
report('No stack or method named in the site (tool names, test links)', methodHits.length === 0, methodHits.join(' | '));
// The demo site is never linked (owner, 26 Oct 2026): visitors ask on WhatsApp instead.
const demoHost = ['demo', 'viraajautomates', 'tech'].join('.');
const demoHits = siteText.filter(([, t]) => t.includes(demoHost) || t.includes('riya=open')).map(([f]) => f);
report('Zero links to the demo site in the site files', demoHits.length === 0, demoHits.join(' '));
// No speed claims (owner, 26 Oct 2026).
const speed = /in seconds|within seconds|instant|within the hour|in minutes|lightning|blazing/i;
// Visitor-facing text lives in the pages and in the two scripts that write sentences.
const speedHits = siteText.filter(([f]) => /\.html$|clock\.js$|message\.js$/.test(f)).filter(([, t]) => speed.test(t.replace(/<script[\s\S]*?<\/script>/g, ''))).map(([f, t]) => `${f}: ${t.match(speed)[0]}`);
report('No speed claims ("in seconds" and the like)', speedHits.length === 0, speedHits.join(' | '));
report('No "Sample" names left (fictional names, captions say "names changed")', !siteText.some(([f, t]) => f.endsWith('.html') && /[A-Z][a-z]+ Sample/.test(t)));
report('No "small business" anywhere a visitor can read', !siteText.some(([, t]) => /small business/i.test(t)));
const copy = html.map((f) => readFileSync(f, 'utf8')).join('\n');
report('No "reminders" claim anywhere', !/remind/i.test(copy));
report('No "Line 01" / "Line open" labels left', !/\(\s*Line\b|Line open|No line here/.test(copy));
report('No badges drawn on images', !/snap__tag|class="[^"]*badge/.test(copy));

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-unsafe-swiftshader'] });
const fresh = async (opts = {}, seen = true) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  if (seen) await ctx.addInitScript(() => { try { sessionStorage.setItem('va-intro', '1'); } catch (e) {} });
  return ctx;
};

// ---------- Footer, images, links ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  const links = new Map();
  for (const path of ['/', '/work/smile-dental/', '/privacy', '/404.html']) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const foot = await page.evaluate(() => [...document.querySelectorAll('footer p')].map((p) => p.textContent.trim()).find((t) => t.startsWith('©')));
    report(`Footer line on ${path}`, foot === '© 2026 Nexoraa. Viraaj Automates is a Nexoraa brand.', foot);
    // Every image has a source that loads, with width and height set (below the fold: lazy)
    const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.loading, top: i.getBoundingClientRect().top + scrollY })));
    const bad = imgs.filter((i) => !i.src || !i.w || !i.h || (i.top > 1200 && i.lazy !== 'lazy'));
    report(`Images on ${path}: source, width, height, lazy below the fold`, bad.length === 0, bad.map((i) => i.src).join(' '));
    for (const href of await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))) links.set(href, path);
    // Every file the page references (img, source, poster, lightbox targets) loads
    const refs = await page.evaluate(() => {
      const u = (x) => new URL(x, location.href).href;
      const out = [];
      document.querySelectorAll('img[src]').forEach((i) => out.push(u(i.getAttribute('src'))));
      document.querySelectorAll('source[srcset]').forEach((s) => s.getAttribute('srcset').split(',').forEach((p) => out.push(u(p.trim().split(' ')[0]))));
      document.querySelectorAll('source[src]').forEach((s) => out.push(u(s.getAttribute('src'))));
      document.querySelectorAll('video[poster]').forEach((v) => out.push(u(v.getAttribute('poster'))));
      document.querySelectorAll('[data-full], [data-fallback]').forEach((t) => { if (t.dataset.full) out.push(u(t.dataset.full)); if (t.dataset.fallback) out.push(u(t.dataset.fallback)); });
      return [...new Set(out)].filter((x) => !x.startsWith('data:'));
    });
    const miss = [];
    for (const r of refs) { const res = await page.request.get(r); if (res.status() !== 200) miss.push(`${r} (${res.status()})`); }
    report(`Every image and video file on ${path} exists (${refs.length})`, miss.length === 0, miss.join(' '));
    // Captions: every figure caption says "Demo"
    const caps = await page.evaluate(() => [...document.querySelectorAll('main figcaption')].map((c) => c.textContent.trim()));
    if (caps.length) { const bad = caps.filter((c) => !/Demo/.test(c)); report(`Every caption on ${path} says "Demo" (${caps.length})`, bad.length === 0, bad.join(' | ')); }
    // A caption whose picture shows a (fictional) name ends "Demo · names changed".
    const named = await page.evaluate(() => [...document.querySelectorAll('main figure')].filter((f) => /Asha Rao/.test(f.textContent + [...f.querySelectorAll('img')].map((i) => i.alt).join(' '))).map((f) => f.querySelector('figcaption')?.textContent.trim() || '(no caption)'));
    if (named.length) { const badN = named.filter((c) => !/Demo · names changed$/.test(c)); report(`Captions showing a name end "Demo · names changed" on ${path} (${named.length})`, badN.length === 0, badN.join(' | ')); }
    // Section labels: one format, "( Word )"
    const labels = await page.evaluate(() => [...document.querySelectorAll('.t-label')].map((l) => l.textContent.trim().replace(/\s+/g, ' ')));
    const badL = labels.filter((l) => !/^\( [^()]+ \)$/.test(l));
    report(`Labels on ${path} all read "( … )"`, badL.length === 0, badL.join(' | '));
  }
  // Internal links: 200; in-page anchors: target exists
  const broken = [];
  const wa = [];
  for (const [href, from] of links) {
    const u = new URL(href);
    if (u.protocol === 'mailto:') { if (u.pathname !== 'viraaj.automates@gmail.com') broken.push(href); continue; }
    if (u.hostname === 'wa.me') { wa.push(href); continue; }
    if (u.origin === BASE) {
      if (u.hash && u.pathname === '/') { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); if (!(await page.$(u.hash))) broken.push(`${href} (from ${from})`); continue; }
      const r = await page.request.get(href); if (r.status() !== 200) broken.push(`${href} ${r.status()} (from ${from})`);
      continue;
    }
    // External: anything else must answer
    try { const r = await page.request.get(href, { timeout: 15000 }); if (r.status() >= 400) broken.push(`${href} ${r.status()}`); } catch (e) { broken.push(`${href} (${String(e).slice(0, 60)})`); }
  }
  report('Every link works (internal pages, anchors, email)', broken.length === 0, broken.join(' | '));
  const waBad = wa.filter((h) => { const u = new URL(h); return u.pathname !== '/919653375679' || !u.searchParams.get('text'); });
  const texts = new Set(wa.map((h) => new URL(h).searchParams.get('text')));
  const want = ["Hi Viraaj, I'd like the free check. Business name: ", "Hi Viraaj, I'd like to know where I stand on Google. Business name: ", 'Hi Viraaj, can you check my website? Link: ', 'Hi Viraaj, I found your website and have a question.', 'Hi Viraaj, I saw the demo on your website. Can you show me how it would work for my business?'];
  report('WhatsApp prefilled texts: free check, Google, website, question, live demo', want.every((t) => texts.has(t)), want.filter((t) => !texts.has(t)).join(' | '));
  report(`Every WhatsApp link opens +91 96533 75679 with prefilled text (${wa.length} links)`, wa.length > 0 && waBad.length === 0, [...new Set(wa.map((h) => new URL(h).searchParams.get('text')))].map((t) => `"${t}"`).join(' / '));
  await ctx.close();
}

// ---------- No sideways scroll ----------
{
  const over = [];
  for (const w of [360, 375, 414, 768, 1024, 1440]) {
    const ctx = await fresh({ viewport: { width: w, height: 800 }, isMobile: w < 768, hasTouch: w < 768 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    let worst = 0;
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(120);
      worst = Math.max(worst, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    }
    if (worst > 0) over.push(`${w}px: ${worst}px`);
    await ctx.close();
  }
  report('No horizontal scroll at 360, 375, 414, 768, 1024, 1440', over.length === 0, over.join(' '));
}

// ---------- Nothing looks empty (scripts/check-scroll.mjs) ----------
await checkScroll({ browser, fresh, report, base: BASE });

// ---------- How it works never overlaps (scripts/check-how.mjs) ----------
await checkHow({ browser, base: BASE, report });

// ---------- Intro ----------
{
  const ctx = await fresh({}, false);
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  const present = await page.waitForSelector('[data-intro]', { state: 'attached', timeout: 4000 }).then(() => true, () => false);
  await page.waitForSelector('[data-intro]', { state: 'detached', timeout: 6000 });
  const ms = Date.now() - t0;
  report('Intro shows on the first visit and is gone within 2.5 s of starting', present && ms > 1500 && ms < 3300, `removed ${ms} ms after navigation (includes page load and the ≤400 ms font wait)`);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const again = await page.evaluate(() => !!document.querySelector('[data-intro]'));
  report('Intro does not show again in the same session', !again);
  await ctx.close();
  for (const [name, act] of [['click', (p) => p.mouse.click(700, 450)], ['scroll', (p) => p.mouse.wheel(0, 200)], ['key', (p) => p.keyboard.press('ArrowDown')]]) {
    const c = await fresh({}, false);
    const p = await c.newPage();
    await p.goto(BASE + '/', { waitUntil: 'commit' });
    await p.waitForSelector('[data-intro]', { timeout: 4000 });
    await p.waitForTimeout(450);
    const t = Date.now();
    await act(p);
    await p.waitForSelector('[data-intro]', { state: 'detached', timeout: 3000 }).catch(() => {});
    const gone = await p.evaluate(() => !document.querySelector('[data-intro]'));
    report(`Intro skips on ${name}`, gone && Date.now() - t < 600, `${Date.now() - t} ms`);
    await c.close();
  }
  const r = await fresh({ reducedMotion: 'reduce' }, false);
  const rp = await r.newPage();
  await rp.goto(BASE + '/', { waitUntil: 'load' });
  report('Intro is absent with reduced motion', !(await rp.evaluate(() => !!document.querySelector('[data-intro]') || document.documentElement.classList.contains('intro-on'))));
  await r.close();
}

// ---------- Hero on a repeat visit: H1 visible within 1 s ----------
{
  const ctx = await fresh({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForSelector('.hero__title', { timeout: 5000 });
  const t0 = Date.now();
  let seen = -1;
  while (Date.now() - t0 < 3000) {
    const ok = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('.hero__title .line-mask > span')];
      return spans.length > 0 && spans.every((s) => { const m = new DOMMatrix(getComputedStyle(s).transform); return Math.abs(m.m42) < s.offsetHeight * 0.5; });
    });
    if (ok) { seen = Date.now() - t0; break; }
    await page.waitForTimeout(50);
  }
  report('Repeat visit at 375: the H1 is visible within 1 s of first paint', seen >= 0 && seen <= 1000, `${seen} ms`);
  await ctx.close();
}

// ---------- Hover card follows the page while it scrolls under a still pointer ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const el = document.querySelector('[data-preview="viraaj"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 400); });
  await page.waitForTimeout(1500);
  const box = await page.$eval('[data-preview="viraaj"] .pw__word', (e) => { const r = e.getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; });
  await page.mouse.move(box[0] - 40, box[1] + 80);
  await page.mouse.move(box[0], box[1], { steps: 5 });
  await page.waitForTimeout(800);
  const shown = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1600);
  const vis = await page.evaluate(() => getComputedStyle(document.querySelector('[data-pcard]')).visibility === 'visible');
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pw')?.dataset.preview || null, box);
  report('Hover card: hover "Viraaj", scroll without moving the mouse: the card hides (or switches) with the page', shown && (under ? vis : !vis), `shown ${shown}, visible after scroll ${vis}, trigger under pointer: ${under}`);
  await ctx.close();
}

// ---------- Keyboard ----------
{
  const ctx = await fresh();
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const seen = [];
  let noRing = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return null;
      const cs = getComputedStyle(a); const w = a.querySelector('.pw__word, .tile__shot'); const ws = w ? getComputedStyle(w) : null;
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (ws && ws.outlineStyle !== 'none' && parseFloat(ws.outlineWidth) >= 2);
      return { label: (a.getAttribute('aria-label') || a.textContent || a.className).trim().replace(/\s+/g, ' ').slice(0, 40), ring, tag: a.tagName };
    });
    if (!f) continue;
    seen.push(f.label);
    if (!f.ring) noRing.push(f.label);
  }
  report('Keyboard: every focused element shows a 2 px outline', noRing.length === 0, noRing.slice(0, 6).join(' | '));
  report('Keyboard: Tab reaches the service titles, buttons and footer links', ['Local SEO', 'Websites', 'Riya, AI receptionist', 'Automations', 'Find out where you stand on Google', 'Ask me for a live demo', 'Read the full case study', 'Get my free check'].every((t) => seen.some((s) => s.includes(t))), `${seen.length} stops`);
  // Menu: focus trap, Escape, focus return
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.focus('[data-menu-btn]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const inside = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); inside.push(await page.evaluate(() => !!document.activeElement.closest('[data-menu], [data-nav]'))); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  const back = await page.evaluate(() => document.activeElement.matches('[data-menu-btn]') && document.querySelector('[data-menu]').hidden);
  report('Menu traps focus while open', inside.every(Boolean));
  report('Escape closes the menu and returns focus to the menu button', back);
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
